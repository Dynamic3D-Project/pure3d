<script lang="ts">
	import { base } from '$app/paths';
	import { authStore } from '$lib/database/stores/auth.svelte';
	import { pb } from '$lib/database/client';
	import { goto } from '$app/navigation';
	import { onDestroy, onMount } from 'svelte';
	import { ROLE_LABELS } from '$lib/types/roles';
	import EditionCard from '$lib/components/cards/EditionCard.svelte';
	import CollectionCard from '$lib/components/cards/CollectionCard.svelte';
	import { getCollectionThumbnailUrl, getEditionRoot, getEditionThumbnailUrl } from '$lib/utils/asset-urls';
	import StatusBadge from '$lib/components/workflow/StatusBadge.svelte';
	import WorkflowTimeline from '$lib/components/workflow/WorkflowTimeline.svelte';
	import { EditionStatus } from '$lib/types/roles';
	import type { ReviewAssignment, EditionReview } from '$lib/types/reviews';
	import { ReviewDecision } from '$lib/types/reviews';
	import toast from 'svelte-french-toast';

	interface DashEdition {
		id: string;
		title: string;
		status: EditionStatus;
		collectionTitle: string;
		thumbnail: string;
		created: string;
	}

	interface ProfileData {
		displayName: string;
		username: string;
		email: string;
		profilePicture: string;
		profilePictureUrl: string;
		orcid: string;
		affiliation: string;
		titleRole: string;
		bio: string;
		socials: string;
		role: string;
		verified: boolean;
		joinDate: string;
	}

	let profileData = $state<ProfileData | null>(null);
	let isEditing = $state(false);
	let saveMessage = $state('');
	let errorMessage = $state('');
	let isLoading = $state(true);
	let isSaving = $state(false);
	let editions = $state<any[]>([]);
	let collections = $state<any[]>([]);
	let myEditions = $state<DashEdition[]>([]);
	let myAssignments = $state<(ReviewAssignment & { edition?: DashEdition })[]>([]);
	let myReviews = $state<EditionReview[]>([]);
	let workTab = $state<'editions' | 'reviews'>('editions');
	let deletingId = $state<string | null>(null);

	let pendingAssignments = $derived(
		myAssignments.filter((assignment) => {
			const hasReview = myReviews.some(
				(review) =>
					review.editionId === assignment.editionId && review.reviewStage === assignment.reviewStage
			);
			return !hasReview;
		})
	);
	let completedAssignments = $derived(
		myAssignments.filter((assignment) =>
			myReviews.some(
				(review) =>
					review.editionId === assignment.editionId && review.reviewStage === assignment.reviewStage
			)
		)
	);

	let tempData = $state({
		displayName: '',
		username: '',
		orcid: '',
		affiliation: '',
		titleRole: '',
		bio: '',
		socials: ''
	});
	let profilePictureFile = $state<File | null>(null);
	let profilePicturePreviewUrl = $state('');

	// Load user profile data
	onMount(async () => {
		if (!authStore.isAuthenticated) {
			goto('/');
			return;
		}

		await loadProfile();
	});

	onDestroy(() => {
		clearProfilePictureFile();
	});

	function clearProfilePictureFile() {
		profilePictureFile = null;
		if (profilePicturePreviewUrl) URL.revokeObjectURL(profilePicturePreviewUrl);
		profilePicturePreviewUrl = '';
	}

	function selectProfilePicture(event: Event) {
		const file = (event.currentTarget as HTMLInputElement).files?.[0] ?? null;
		clearProfilePictureFile();
		if (!file) return;

		profilePictureFile = file;
		profilePicturePreviewUrl = URL.createObjectURL(file);
	}

	async function loadProfile() {
		try {
			isLoading = true;
			const currentUser = authStore.user;

			if (!currentUser) {
				goto('/');
				return;
			}

			const user = await pb.collection('users').getOne(currentUser.id);
			pb.authStore.save(pb.authStore.token, user);
			const profilePicture = user.profilePicture || user.avatar || '';

			profileData = {
				displayName: user.nickname || user.username || user.email || 'User',
				username: user.nickname || user.username || '',
				email: user.email,
				profilePicture,
				profilePictureUrl: profilePicture
					? pb.files.getURL(user as any, profilePicture, { thumb: '200x200' })
					: '',
				orcid: user.orcid || '',
				affiliation: user.affiliation || '',
				titleRole: user.titleRole || '',
				bio: user.bio || '',
				socials: user.socials || '',
				role: user.role || authStore.globalRole,
				verified: user.verified,
				joinDate: new Date(user.created).toLocaleDateString('en-US', {
					year: 'numeric',
					month: 'long'
				})
			};
			await loadProfileContent(user.id);
		} catch (error) {
			console.error('Error loading profile:', error);
			errorMessage = 'Failed to load profile data';
		} finally {
			isLoading = false;
		}
	}

	const toArray = (value: unknown): string[] =>
		Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];

	function mapEdition(record: any) {
		const collection = record.expand?.collection;
		const collectionPubNum = collection?.pubNum || 0;
		const editionPubNum = record.pubNum || 1;

		return {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			authors: toArray(record.dcCreator).join(', '),
			thumbnail: collectionPubNum > 0 ? getEditionThumbnailUrl(collectionPubNum, editionPubNum) : '',
			voyagerUrl: collectionPubNum > 0 ? getEditionRoot(collectionPubNum, editionPubNum) : '',
			usageConditions: record.dcRightsLicense || '',
			alternativeVersion: null,
			tags: toArray(record.dcKeyword),
			created: record.created,
			isPublished: record.isPublished,
			pubNum: record.pubNum,
			collectionId: record.collection,
			collection,
			dcTitle: record.dcTitle || null,
			dcSubtitle: record.dcSubtitle || null,
			dcAbstract: record.dcAbstract || null,
			dcDescription: record.dcDescription || null,
			dcCreator: toArray(record.dcCreator),
			dcContributor: toArray(record.dcContributor),
			dcInstitution: toArray(record.dcInstitution),
			dcContact: record.dcContact || null,
			dcSubject: toArray(record.dcSubject),
			dcKeyword: toArray(record.dcKeyword),
			dcAudience: toArray(record.dcAudience),
			dcLanguage: toArray(record.dcLanguage),
			dcSource: toArray(record.dcSource),
			dcCoveragePeriod: toArray(record.dcCoveragePeriod),
			dcCoveragePlace: record.dcCoveragePlace || null,
			dcCoverageCountry: toArray(record.dcCoverageCountry),
			dcCoverageTemporal: record.dcCoverageTemporal || null,
			dcCoverageGeo: record.dcCoverageGeo || null,
			dcRightsHolder: record.dcRightsHolder || null,
			dcRightsLicense: record.dcRightsLicense || null,
			dcDatePublished: record.dcDatePublished || null,
			dcDateUnPublished: record.dcDateUnPublished || null,
			dcDateCreated: record.dcDateCreated || null,
			dcDateModified: record.dcDateModified || null,
			dcFunder: toArray(record.dcFunder),
			dcProvenance: record.dcProvenance || null,
			dcDoi: toArray(record.dcDoi),
			peerReviewKind: record.peerReviewKind || null,
			peerReviewContent: record.peerReviewContent || null,
			hasPeerReview: !!record.peerReviewKind && record.peerReviewKind !== 'No peer review',
			peerReviewRequested: record.peerReviewRequested || false,
			reviewStage: record.reviewStage ?? null,
			peerReviewStamp: record.peerReviewStamp || false,
			publishedAt: record.publishedAt || null,
			publishedBy: record.publishedBy || null,
			settingsAuthorToolName: record.settingsAuthorToolName || null,
			settingsAuthorToolVersion: record.settingsAuthorToolVersion || null,
			settingsSceneFile: record.settingsSceneFile || null
		};
	}

	function mapCollection(record: any, editionCount = 0) {
		return {
			id: record.id,
			slug: record.id,
			title: record.dcTitle || record.title,
			description: record.dcAbstract || '',
			thumbnail: record.pubNum > 0 ? getCollectionThumbnailUrl(record.pubNum) : '',
			editionIds: [],
			editionCount,
			isVisible: record.isVisible
		};
	}

	async function loadProfileContent(userId: string) {
		const [assignmentResult, reviewResult, editionUsers, collectionUsers] = await Promise.all([
			pb.collection('reviewAssignments').getList(1, 500, {
				filter: `reviewerId = "${userId}"`,
				sort: '-created'
			}),
			pb.collection('editionReviews').getList(1, 500, {
				filter: `reviewerId = "${userId}"`,
				sort: '-created'
			}),
			pb.collection('editionUsers').getList(1, 100, {
				filter: `userId = "${userId}" && role = "author"`,
				expand: 'editionId,editionId.collection'
			}),
			pb.collection('collectionUsers').getList(1, 100, {
				filter: `userId = "${userId}"`,
				expand: 'collection'
			})
		]);

		myReviews = reviewResult.items.map((review) => ({
			id: review.id,
			editionId: review.editionId,
			reviewerId: review.reviewerId,
			reviewStage: review.reviewStage,
			decision: review.decision as ReviewDecision,
			comment: review.comment || null,
			created: review.created,
			updated: review.updated
		}));

		const authorEditionIds = editionUsers.items.map((item) => item.editionId);
		const assignmentEditionIds = assignmentResult.items.map((item) => item.editionId);
		const allEditionIds = [...new Set([...authorEditionIds, ...assignmentEditionIds])];
		const editionRecords = new Map<string, any>();
		const dashboardEditions = new Map<string, DashEdition>();

		if (allEditionIds.length > 0) {
			const editionResult = await pb.collection('editions').getList(1, 500, {
				filter: allEditionIds.map((id) => `id = "${id}"`).join(' || '),
				expand: 'collection'
			});

			for (const record of editionResult.items) {
				const collection = record.expand?.collection;
				const collectionPubNum = collection?.pubNum || 0;
				const editionPubNum = record.pubNum || 0;
				const thumbnail =
					record.thumbnail ||
					(collectionPubNum > 0 && editionPubNum > 0
						? getEditionThumbnailUrl(collectionPubNum, editionPubNum)
						: '');

				editionRecords.set(record.id, record);
				dashboardEditions.set(record.id, {
					id: record.id,
					title: record.dcTitle || record.title,
					status: (record.status as EditionStatus) || EditionStatus.Draft,
					collectionTitle: collection?.title || '',
					thumbnail,
					created: record.created
				});
			}
		}

		editions = authorEditionIds
			.map((id) => editionRecords.get(id))
			.filter((record) => record?.isPublished)
			.map(mapEdition);

		myEditions = authorEditionIds
			.map((id) => dashboardEditions.get(id))
			.filter((edition): edition is DashEdition => !!edition);

		myAssignments = assignmentResult.items.map((assignment) => ({
			id: assignment.id,
			editionId: assignment.editionId,
			reviewerId: assignment.reviewerId,
			reviewStage: assignment.reviewStage,
			assignedBy: assignment.assignedBy,
			status: assignment.status,
			created: assignment.created,
			updated: assignment.updated,
			edition: dashboardEditions.get(assignment.editionId)
		}));

		const editionCounts = new Map<string, number>();
		for (const edition of editions) {
			editionCounts.set(edition.collectionId, (editionCounts.get(edition.collectionId) || 0) + 1);
		}

		collections = collectionUsers.items
			.map((item) => item.expand?.collection)
			.filter((record) => record?.isVisible)
			.map((record) => mapCollection(record, editionCounts.get(record.id) || 0));
	}

	function startEdit() {
		if (!profileData) return;

		isEditing = true;
		tempData = {
			displayName: profileData.displayName,
			username: profileData.username,
			orcid: profileData.orcid,
			affiliation: profileData.affiliation,
			titleRole: profileData.titleRole,
			bio: profileData.bio,
			socials: profileData.socials
		};
		clearProfilePictureFile();
		saveMessage = '';
		errorMessage = '';
	}

	function cancelEdit() {
		isEditing = false;
		tempData = {
			displayName: profileData?.displayName || '',
			username: profileData?.username || '',
			orcid: profileData?.orcid || '',
			affiliation: profileData?.affiliation || '',
			titleRole: profileData?.titleRole || '',
			bio: profileData?.bio || '',
			socials: profileData?.socials || ''
		};
		clearProfilePictureFile();
		errorMessage = '';
	}

	async function saveProfile() {
		if (!authStore.user?.id) return;

		try {
			isSaving = true;
			errorMessage = '';

			const formData = new FormData();
			formData.set('nickname', tempData.username);
			formData.set('orcid', tempData.orcid);
			formData.set('affiliation', tempData.affiliation);
			formData.set('titleRole', tempData.titleRole);
			formData.set('bio', tempData.bio);
			formData.set('socials', tempData.socials);
			if (profilePictureFile) {
				formData.append('profilePicture', profilePictureFile);
				formData.append('avatar', profilePictureFile);
			}

			const updatedUser = await pb.collection('users').update(authStore.user.id, formData);
			const freshUser = await pb.collection('users').getOne(authStore.user.id);
			pb.authStore.save(pb.authStore.token, freshUser);
			const profilePicture = freshUser.profilePicture || freshUser.avatar || updatedUser.profilePicture || updatedUser.avatar || '';

			if (profileData) {
				profileData.displayName = tempData.username || tempData.displayName;
				profileData.username = tempData.username;
				profileData.profilePicture = profilePicture;
				profileData.profilePictureUrl = profilePicture
					? pb.files.getURL(freshUser, profilePicture, { thumb: '200x200' })
					: '';
				profileData.orcid = tempData.orcid;
				profileData.affiliation = tempData.affiliation;
				profileData.titleRole = tempData.titleRole;
				profileData.bio = tempData.bio;
				profileData.socials = tempData.socials;
			}

			clearProfilePictureFile();
			isEditing = false;
			saveMessage = '✓ Profile updated successfully!';
			setTimeout(() => {
				saveMessage = '';
			}, 3000);
		} catch (error: any) {
			console.error('Error updating profile:', error);
			errorMessage = error?.message || 'Failed to update profile. Please try again.';
		} finally {
			isSaving = false;
		}
	}

	function socialHref(value: string) {
		return /^https?:\/\//i.test(value) ? value : `https://${value}`;
	}

	function socialLabel(value: string) {
		return value.replace(/^https?:\/\//i, '').replace(/\/$/, '');
	}

	function socialLinks(value: string) {
		return value
			.split(/\n+/)
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function formatDate(dateStr: string): string {
		if (!dateStr) return '';
		const date = new Date(dateStr);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function getStageLabel(stage: number): string {
		switch (stage) {
			case 1:
				return 'Concept';
			case 2:
				return 'Alpha';
			case 3:
				return 'Final';
			default:
				return `Stage ${stage}`;
		}
	}

	function workflowStepHref(editionId: string, status: EditionStatus): string {
		const workflowPath = `${base}/editions/${editionId}/workflow`;

		switch (status) {
			case EditionStatus.Draft:
			case EditionStatus.ConceptSubmitted:
			case EditionStatus.EditorialReview:
			case EditionStatus.ConceptAccepted:
			case EditionStatus.ConceptRejected:
				return `${workflowPath}#concept`;
			case EditionStatus.AlphaReview:
			case EditionStatus.AlphaRevisions:
			case EditionStatus.AlphaAccepted:
			case EditionStatus.AlphaRejected:
				return `${workflowPath}#alpha`;
			case EditionStatus.FinalReview:
			case EditionStatus.FinalRevisions:
				return `${workflowPath}#final`;
			case EditionStatus.Published:
				return `${workflowPath}#published`;
			default:
				return workflowPath;
		}
	}

	async function deleteDraft(edition: DashEdition) {
		if (edition.status !== EditionStatus.Draft) return;
		const confirmed = confirm(`Delete draft "${edition.title}"? This cannot be undone.`);
		if (!confirmed) return;

		deletingId = edition.id;
		try {
			await pb.collection('editions').delete(edition.id);
			myEditions = myEditions.filter((item) => item.id !== edition.id);
			toast.success(`Deleted "${edition.title}"`);
		} catch (error) {
			console.error('Delete failed:', error);
			toast.error((error as Error).message || 'Failed to delete edition');
		} finally {
			deletingId = null;
		}
	}
</script>

{#if isLoading}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<span class="loading loading-lg loading-spinner"></span>
			<p class="mt-4 text-base-content/60">Loading profile...</p>
		</div>
	</div>
{:else if authStore.isAuthenticated && profileData}
	<div class="container mx-auto max-w-5xl px-4 py-8">
		<section class="overflow-hidden rounded-2xl border border-base-300 bg-base-100 shadow-sm">
			<div class="h-24 bg-gradient-to-r from-base-300 via-base-200 to-base-100"></div>
			<div class="flex flex-col gap-6 p-6 pt-0 sm:flex-row sm:items-end">
				<div class="-mt-12 shrink-0">
					<div class="avatar placeholder block">
						{#if profilePicturePreviewUrl || profileData.profilePictureUrl}
							<div class="w-32 rounded-full ring-4 ring-base-100">
								<img src={profilePicturePreviewUrl || profileData.profilePictureUrl} alt="{profileData.displayName} profile" />
							</div>
						{:else}
							<div class="w-32 rounded-full bg-neutral text-neutral-content ring-4 ring-base-100">
								<span class="text-4xl">{profileData.displayName.charAt(0).toUpperCase()}</span>
							</div>
						{/if}
					</div>
					{#if isEditing}
						<label class="btn btn-outline btn-xs mt-3 w-32 overflow-hidden">
							{profilePictureFile ? 'Photo selected' : 'Photo'}
							<input type="file" accept="image/png,image/jpeg,image/webp,image/avif" class="hidden" onchange={selectProfilePicture} />
						</label>
					{/if}
				</div>

				<div class="min-w-0 flex-1">
					{#if isEditing}
						<div class="max-w-2xl">
							<div class="flex flex-wrap items-center gap-2">
								<label for="username" class="sr-only">Username</label>
								<input id="username" type="text" bind:value={tempData.username} class="input input-bordered h-auto min-h-0 w-auto max-w-full bg-base-100 px-3 py-1 text-3xl font-bold leading-tight" placeholder="Display name" />
								<span class="badge badge-neutral">{ROLE_LABELS[profileData.role] || profileData.role}</span>
								{#if profileData.verified}
									<span class="badge badge-success">Verified</span>
								{/if}
							</div>
							<div class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-base text-base-content/70">
								<input id="title-role" type="text" bind:value={tempData.titleRole} class="input input-bordered h-9 min-h-0 w-48 bg-base-100 px-3 py-1" placeholder="Title / role position" />
								<span class="text-base-content/30">at</span>
								<input id="affiliation" type="text" bind:value={tempData.affiliation} class="input input-bordered h-9 min-h-0 w-48 bg-base-100 px-3 py-1" placeholder="Affiliation" />
							</div>
						</div>
					{:else}
						<div class="flex flex-wrap items-center gap-2">
							<h1 class="text-3xl font-bold leading-tight">{profileData.displayName}</h1>
							<span class="badge badge-neutral">{ROLE_LABELS[profileData.role] || profileData.role}</span>
							{#if profileData.verified}
								<span class="badge badge-success">Verified</span>
							{/if}
						</div>
						{#if profileData.titleRole || profileData.affiliation}
							<p class="mt-2 text-base text-base-content/70">
								{#if profileData.titleRole}{profileData.titleRole}{/if}{#if profileData.titleRole && profileData.affiliation} at {/if}{#if profileData.affiliation}{profileData.affiliation}{/if}
							</p>
						{/if}
					{/if}
					<p class="mt-1 text-sm text-base-content/50">
						{profileData.email} · Member since {profileData.joinDate}
					</p>
				</div>

				<div class="flex shrink-0 gap-2">
					{#if isEditing}
						<button class="btn btn-primary btn-sm" onclick={saveProfile} disabled={isSaving}>
							{isSaving ? 'Saving...' : 'Save'}
						</button>
						<button class="btn btn-ghost btn-sm" onclick={cancelEdit} disabled={isSaving}>Cancel</button>
					{:else}
						<button onclick={startEdit} class="btn btn-primary btn-sm">Edit Profile</button>
					{/if}
				</div>
			</div>

			{#if saveMessage}
				<div class="mx-6 mb-4 alert alert-success">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{saveMessage}</span>
				</div>
			{/if}

			{#if errorMessage}
				<div class="mx-6 mb-4 alert alert-error">
					<svg
						xmlns="http://www.w3.org/2000/svg"
						class="h-6 w-6 shrink-0 stroke-current"
						fill="none"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
					<span>{errorMessage}</span>
				</div>
			{/if}

			<div class="grid gap-8 border-t border-base-300 p-6 lg:grid-cols-[1fr_20rem]">
				<div class="space-y-6">
					<div>
						<h3 class="text-sm font-semibold uppercase tracking-wide text-base-content/50">Bio</h3>
						{#if isEditing}
							<textarea id="bio" bind:value={tempData.bio} class="textarea-bordered textarea mt-2 min-h-40 w-full" placeholder="Short public biography"></textarea>
						{:else if profileData.bio}
							<div class="prose mt-2 max-w-none text-base-content/80">{@html profileData.bio}</div>
						{:else}
							<p class="mt-2 text-base-content/50">Add a short bio.</p>
						{/if}
					</div>
				</div>

				<aside class="space-y-3">
					<div class="rounded-xl bg-base-200 p-4">
						<div class="text-xs font-semibold uppercase tracking-wide text-base-content/50">Profile links</div>
						{#if isEditing}
							<label for="orcid" class="mt-3 block text-xs font-medium text-base-content/60">ORCID</label>
							<input id="orcid" type="url" bind:value={tempData.orcid} class="input-bordered input mt-1 w-full" placeholder="https://orcid.org/0000-0000-0000-0000" />
							<label for="socials" class="mt-4 block text-xs font-medium text-base-content/60">Links</label>
							<textarea id="socials" bind:value={tempData.socials} class="textarea-bordered textarea mt-1 min-h-28 w-full" placeholder="One link per line"></textarea>
						{:else}
							{#if profileData.orcid || profileData.socials}
								<div class="mt-3 flex flex-col gap-2">
									{#if profileData.orcid}
										<a class="btn btn-outline btn-sm justify-start" href={profileData.orcid} target="_blank" rel="noreferrer">
											ORCID: {socialLabel(profileData.orcid)}
										</a>
									{/if}
									{#each socialLinks(profileData.socials) as social}
										<a class="btn btn-outline btn-sm justify-start" href={socialHref(social)} target="_blank" rel="noreferrer">
											{socialLabel(social)}
										</a>
									{/each}
								</div>
							{:else}
								<p class="mt-3 text-base-content/50">Add ORCID or social links.</p>
							{/if}
						{/if}
					</div>
				</aside>
			</div>
		</section>

		<section class="mt-10 rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm">
			<div class="mb-6 flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2 class="text-2xl font-semibold">My Work</h2>
					<p class="mt-1 text-sm text-base-content/60">Authored editions and review assignments.</p>
				</div>
				<div class="tabs-bordered tabs">
					<button
						class="tab"
						class:tab-active={workTab === 'editions'}
						onclick={() => (workTab = 'editions')}
					>
						My Editions
						{#if myEditions.length > 0}
							<span class="ml-1 badge badge-sm">{myEditions.length}</span>
						{/if}
					</button>
					<button
						class="tab"
						class:tab-active={workTab === 'reviews'}
						onclick={() => (workTab = 'reviews')}
					>
						My Reviews
						{#if pendingAssignments.length > 0}
							<span class="ml-1 badge badge-sm badge-primary">{pendingAssignments.length}</span>
						{/if}
					</button>
				</div>
			</div>

			{#if workTab === 'editions'}
				{#if myEditions.length === 0}
					<p class="py-8 text-center text-base-content/60">You are not listed as an author on any editions.</p>
				{:else}
					<div class="space-y-3">
						{#each myEditions as edition (edition.id)}
							<div class="rounded-box border border-base-300 bg-base-100 p-4">
								<div class="flex gap-4">
									{#if edition.thumbnail}
										<img src={edition.thumbnail} alt={edition.title} class="size-16 shrink-0 rounded-lg object-cover" />
									{:else}
										<div class="flex size-16 shrink-0 items-center justify-center rounded-lg bg-base-200 text-base-content/30">
											<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
												<path stroke-linecap="round" stroke-linejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
											</svg>
										</div>
									{/if}
									<div class="min-w-0 flex-1">
										<div class="flex flex-wrap items-center justify-between gap-3">
											<div class="flex flex-wrap items-center gap-3">
												<span class="font-medium">{edition.title}</span>
												<StatusBadge status={edition.status} />
											</div>
											<div class="flex items-center gap-2">
												{#if edition.status === EditionStatus.Draft}
													<button type="button" class="btn text-error btn-ghost btn-sm" disabled={deletingId === edition.id} onclick={() => deleteDraft(edition)} aria-label="Delete draft">
														{deletingId === edition.id ? 'Deleting...' : 'Delete'}
													</button>
												{/if}
												<a href="{base}/editions/{edition.id}/workflow" class="btn btn-ghost btn-sm">View Workflow</a>
											</div>
										</div>
										{#if edition.collectionTitle}
											<p class="mt-1 text-sm text-base-content/50">in {edition.collectionTitle}</p>
										{/if}
									</div>
								</div>
								<div class="mt-3">
									<WorkflowTimeline currentStatus={edition.status} hrefForStatus={(status) => workflowStepHref(edition.id, status)} />
								</div>
							</div>
						{/each}
					</div>
				{/if}
			{:else}
				{#if pendingAssignments.length > 0}
					<h3 class="mb-3 text-lg font-semibold">Pending Reviews</h3>
					<div class="mb-6 space-y-2">
						{#each pendingAssignments as assignment (assignment.id)}
							{@const edition = assignment.edition}
							<div class="rounded-box border border-base-300 bg-base-100 p-4">
								<div class="flex flex-wrap items-center justify-between gap-3">
									<div class="flex flex-wrap items-center gap-3">
										<span class="font-medium">{edition?.title || 'Unknown Edition'}</span>
										{#if edition}<StatusBadge status={edition.status} />{/if}
										<span class="badge badge-ghost badge-sm">{getStageLabel(assignment.reviewStage)}</span>
									</div>
									<a href="{base}/editions/{assignment.editionId}/workflow" class="btn btn-primary btn-sm">Start Review</a>
								</div>
								{#if edition?.collectionTitle}
									<p class="mt-1 text-sm text-base-content/50">in {edition.collectionTitle}</p>
								{/if}
								<p class="mt-1 text-xs text-base-content/40">Assigned {formatDate(assignment.created)}</p>
							</div>
						{/each}
					</div>
				{/if}

				{#if completedAssignments.length > 0}
					<h3 class="mb-3 text-lg font-semibold">Completed Reviews</h3>
					<div class="space-y-2">
						{#each completedAssignments as assignment (assignment.id)}
							{@const edition = assignment.edition}
							{@const review = myReviews.find((item) => item.editionId === assignment.editionId && item.reviewStage === assignment.reviewStage)}
							<div class="rounded-box border border-base-200 bg-base-200/30 p-4">
								<div class="flex flex-wrap items-center gap-3">
									<span class="font-medium">{edition?.title || 'Unknown Edition'}</span>
									{#if edition}<StatusBadge status={edition.status} />{/if}
									<span class="badge badge-ghost badge-sm">{getStageLabel(assignment.reviewStage)}</span>
									{#if review}
										<span class="badge badge-sm {review.decision === ReviewDecision.Approve ? 'badge-success' : review.decision === ReviewDecision.Reject ? 'badge-error' : 'badge-warning'}">
											{review.decision === ReviewDecision.Approve ? 'Approved' : review.decision === ReviewDecision.Reject ? 'Rejected' : 'Revisions'}
										</span>
									{/if}
								</div>
								<p class="mt-1 text-xs text-base-content/40">Reviewed {review ? formatDate(review.created) : ''}</p>
							</div>
						{/each}
					</div>
				{/if}

				{#if myAssignments.length === 0}
					<p class="py-8 text-center text-base-content/60">No review assignments yet.</p>
				{/if}
			{/if}
		</section>

		<section class="mt-10">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-semibold">Editions</h2>
				<span class="text-sm text-base-content/60">{editions.length} public</span>
			</div>
			{#if editions.length}
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
					{#each editions as edition (edition.id)}
						<EditionCard {edition} />
					{/each}
				</div>
			{:else}
				<p class="rounded-2xl border border-base-300 bg-base-100 p-6 text-base-content/60 shadow-sm">
					No public editions yet.
				</p>
			{/if}
		</section>

		<section class="mt-10">
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-2xl font-semibold">Collections</h2>
				<span class="text-sm text-base-content/60">{collections.length} public</span>
			</div>
			{#if collections.length}
				<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					{#each collections as collection (collection.id)}
						<CollectionCard {collection} />
					{/each}
				</div>
			{:else}
				<p class="rounded-2xl border border-base-300 bg-base-100 p-6 text-base-content/60 shadow-sm">
					No public collections yet.
				</p>
			{/if}
		</section>
	</div>
{:else}
	<div class="flex min-h-screen items-center justify-center">
		<div class="text-center">
			<h1 class="mb-4 text-2xl font-bold">Please log in to view your profile</h1>
			<a href="{base}/" class="btn btn-primary">Go to Home</a>
		</div>
	</div>
{/if}
