import { expect, test } from 'bun:test';
import { getSchema } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import { Fragment } from '@tiptap/pm/model';
import StarterKit from '@tiptap/starter-kit';
import { VideoEmbed } from './editor-embed';
import {
	CmsColumn,
	CmsColumns,
	ContentImageFigure,
	columnsContent,
	contentImageFigure
} from './editor-content-components';

test('columns have the requested count and cannot contain nested columns', () => {
	const schema = getSchema([
		StarterKit,
		Image,
		ContentImageFigure,
		VideoEmbed,
		Table.configure({ resizable: true }),
		TableRow,
		TableCell,
		TableHeader,
		CmsColumn,
		CmsColumns
	]);
	const columns = schema.nodeFromJSON(columnsContent(3));
	expect(columns.childCount).toBe(3);
	expect(schema.nodes.doc.validContent(Fragment.from(columns))).toBe(true);

	const nested = schema.nodes.cmsColumns.create(null, [
		schema.nodes.cmsColumn.create(null, [schema.nodes.paragraph.create()]),
		schema.nodes.cmsColumn.create(null, [schema.nodes.paragraph.create()])
	]);
	expect(schema.nodes.cmsColumn.validContent(Fragment.from(nested))).toBe(false);
	expect(
		schema.nodes.cmsColumn.validContent(
			Fragment.from(
				schema.nodes.contentImageFigure.create({
					src: '/image.jpg',
					alt: 'A model',
					caption: 'Model detail'
				})
			)
		)
	).toBe(true);
});

test('captioned image figures retain their image description and caption', () => {
	const schema = getSchema([StarterKit, Image, ContentImageFigure]);
	const figure = schema.nodeFromJSON(
		contentImageFigure({
			src: '/images/tablet.jpg',
			alt: 'Carved tablet on a plinth',
			caption: 'Tablet, north face.'
		})
	);
	expect(figure.type.name).toBe('contentImageFigure');
	expect(figure.attrs).toMatchObject({
		src: '/images/tablet.jpg',
		alt: 'Carved tablet on a plinth',
		caption: 'Tablet, north face.'
	});
});
