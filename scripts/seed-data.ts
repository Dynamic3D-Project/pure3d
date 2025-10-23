#!/usr/bin/env bun

import { faker } from '@faker-js/faker';
import PocketBase from 'pocketbase';
import { createInterface } from 'readline';

const POCKETBASE_URL = 'http://localhost:8090';
const TODO_COUNT = 1000;
const POST_COUNT = 500;
const BATCH_SIZE = 100; // Process in batches to avoid overwhelming the API

interface Todo {
	name: string;
	Description: string;
	completed: boolean;
	user: string;
}

interface Post {
	title: string;
	content: string;
}

async function promptCredentials(): Promise<{ email: string; password: string }> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout
	});

	return new Promise((resolve) => {
		rl.question('Enter admin email: ', (email) => {
			rl.question('Enter admin password: ', (password) => {
				rl.close();
				resolve({ email, password });
			});
		});
	});
}

async function authenticateAdmin(pb: PocketBase): Promise<void> {
	const { email, password } = await promptCredentials();

	console.log('\n🔐 Authenticating as admin...');
	try {
		await pb.admins.authWithPassword(email, password);
		console.log('✅ Admin authenticated successfully\n');
	} catch (error) {
		console.error('❌ Authentication failed. Please check your credentials.');
		throw error;
	}
}

async function promptUserEmail(): Promise<string> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout
	});

	return new Promise((resolve) => {
		rl.question('Enter user email to assign todos to (default: user@user.com): ', (email) => {
			rl.close();
			resolve(email.trim() || 'user@user.com');
		});
	});
}

async function getOrCreateAdminUser(pb: PocketBase): Promise<string> {
	const userEmail = await promptUserEmail();

	try {
		// Try to find the user by email
		const users = await pb.collection('users').getFullList({
			filter: `email = "${userEmail}"`
		});

		if (users.length > 0) {
			console.log(`✅ Using user: ${users[0].email}`);
			return users[0].id;
		}
	} catch (err) {
		console.error('Error fetching user:', err);
	}

	throw new Error(`User with email "${userEmail}" not found. Please create this user first in the PocketBase admin panel.`);
}

function generateTodo(userId: string): Todo {
	const todoTypes = [
		() => ({
			name: faker.hacker.verb() + ' ' + faker.hacker.noun(),
			Description: faker.hacker.phrase()
		}),
		() => ({
			name: 'Buy ' + faker.commerce.productName(),
			Description: faker.commerce.productDescription()
		}),
		() => ({
			name: faker.company.catchPhrase(),
			Description: faker.lorem.sentence()
		}),
		() => ({
			name: 'Meeting: ' + faker.company.buzzPhrase(),
			Description: faker.lorem.sentences(2)
		}),
		() => ({
			name: faker.word.verb() + ' ' + faker.word.noun(),
			Description: faker.lorem.paragraph()
		})
	];

	const todoType = faker.helpers.arrayElement(todoTypes);
	const { name, Description } = todoType();

	return {
		name: name.substring(0, 255), // Respect max length
		Description: Description,
		completed: faker.datatype.boolean(0.3), // 30% chance of being completed
		user: userId
	};
}

function generatePost(): Post {
	const postTypes = [
		() => ({
			title: faker.hacker.phrase(),
			content: faker.lorem.paragraphs(faker.number.int({ min: 3, max: 10 }), '\n\n')
		}),
		() => ({
			title: 'How to ' + faker.hacker.verb() + ' ' + faker.hacker.noun(),
			content: `# Introduction\n\n${faker.lorem.paragraph()}\n\n## Key Points\n\n${faker.lorem.paragraphs(3, '\n\n')}\n\n## Conclusion\n\n${faker.lorem.paragraph()}`
		}),
		() => ({
			title: faker.company.catchPhrase(),
			content: faker.lorem.paragraphs(faker.number.int({ min: 5, max: 15 }), '\n\n')
		}),
		() => ({
			title:
				faker.word.adjective() + ' ' + faker.word.noun() + ' in ' + faker.number.int({ min: 2020, max: 2025 }),
			content: `${faker.lorem.paragraph()}\n\n${faker.lorem.paragraphs(4, '\n\n')}`
		})
	];

	const postType = faker.helpers.arrayElement(postTypes);
	return postType();
}

async function seedTodos(pb: PocketBase, userId: string): Promise<void> {
	console.log(`📝 Generating ${TODO_COUNT} todos...`);

	for (let i = 0; i < TODO_COUNT; i += BATCH_SIZE) {
		const batchSize = Math.min(BATCH_SIZE, TODO_COUNT - i);
		const todos = Array.from({ length: batchSize }, () => generateTodo(userId));

		const promises = todos.map((todo) => pb.collection('todos').create(todo));

		await Promise.all(promises);

		const progress = Math.min(i + BATCH_SIZE, TODO_COUNT);
		console.log(`  ✓ Created ${progress}/${TODO_COUNT} todos`);
	}

	console.log('✅ All todos created!\n');
}

async function seedPosts(pb: PocketBase): Promise<void> {
	console.log(`📰 Generating ${POST_COUNT} posts...`);

	for (let i = 0; i < POST_COUNT; i += BATCH_SIZE) {
		const batchSize = Math.min(BATCH_SIZE, POST_COUNT - i);
		const posts = Array.from({ length: batchSize }, () => generatePost());

		const promises = posts.map((post) => pb.collection('posts').create(post));

		await Promise.all(promises);

		const progress = Math.min(i + BATCH_SIZE, POST_COUNT);
		console.log(`  ✓ Created ${progress}/${POST_COUNT} posts`);
	}

	console.log('✅ All posts created!\n');
}

async function clearExistingData(pb: PocketBase): Promise<void> {
	const rl = createInterface({
		input: process.stdin,
		output: process.stdout
	});

	const answer = await new Promise<string>((resolve) => {
		rl.question('⚠️  Clear existing todos and posts? (y/N): ', (ans) => {
			rl.close();
			resolve(ans);
		});
	});

	if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
		console.log('\n🗑️  Clearing existing data...');

		try {
			// Delete all todos
			const todos = await pb.collection('todos').getFullList();
			for (const todo of todos) {
				await pb.collection('todos').delete(todo.id);
			}
			console.log(`  ✓ Deleted ${todos.length} todos`);

			// Delete all posts
			const posts = await pb.collection('posts').getFullList();
			for (const post of posts) {
				await pb.collection('posts').delete(post.id);
			}
			console.log(`  ✓ Deleted ${posts.length} posts`);

			console.log('✅ Data cleared!\n');
		} catch (err) {
			console.error('Error clearing data:', err);
		}
	} else {
		console.log('ℹ️  Keeping existing data\n');
	}
}

async function main() {
	console.log('🚀 PocketBase Data Seeder\n');
	console.log(`📊 Target: ${POCKETBASE_URL}`);
	console.log(`📝 Todos to create: ${TODO_COUNT}`);
	console.log(`📰 Posts to create: ${POST_COUNT}\n`);

	const pb = new PocketBase(POCKETBASE_URL);
	pb.autoCancellation(false); // Disable auto-cancellation for bulk operations

	try {
		// Authenticate as admin
		await authenticateAdmin(pb);

		// Optionally clear existing data
		await clearExistingData(pb);

		// Get user to assign todos to
		const userId = await getOrCreateAdminUser(pb);

		// Seed data
		const startTime = Date.now();

		await seedTodos(pb, userId);
		await seedPosts(pb);

		const endTime = Date.now();
		const duration = ((endTime - startTime) / 1000).toFixed(2);

		console.log(`🎉 Seeding complete in ${duration}s!`);
		console.log(`📊 Created ${TODO_COUNT} todos and ${POST_COUNT} posts`);
	} catch (error) {
		console.error('❌ Error:', error);
		process.exit(1);
	}
}

main();
