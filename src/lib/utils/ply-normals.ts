/**
 * Parses a PLY file and returns a new PLY File with per-vertex normals
 * (nx/ny/nz) added if they were missing. Supports ASCII and binary
 * little/big-endian PLY with triangle faces.
 *
 * If normals are already present, the original file is returned unchanged.
 * If the file cannot be parsed, the original file is returned unchanged
 * (we don't want to block the upload over a parse failure).
 */
export async function addNormalsToPlyFile(file: File): Promise<File> {
	try {
		const buf = await file.arrayBuffer();
		const header = parseHeader(buf);
		if (!header) return file;
		if (header.vertex.props.some((p) => p.name === 'nx')) return file;

		const { positions, faces } = readBody(buf, header);
		if (positions.length === 0 || faces.length === 0) return file;

		const normals = computeVertexNormals(positions, faces);
		const out = writeBinaryLE(positions, normals, faces);
		return new File([out], file.name, { type: file.type });
	} catch {
		return file;
	}
}

type PlyProp = { name: string; type: string };
type PlyListProp = { name: string; countType: string; type: string };
type PlyHeader = {
	format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
	headerLength: number;
	vertex: { count: number; props: PlyProp[] };
	face: { count: number; list: PlyListProp | null };
};

function parseHeader(buf: ArrayBuffer): PlyHeader | null {
	const bytes = new Uint8Array(buf);
	const max = Math.min(bytes.length, 65536);
	let headerText = '';
	let headerEnd = -1;
	for (let i = 0; i < max; i++) {
		headerText += String.fromCharCode(bytes[i]);
		if (headerText.endsWith('end_header\n')) {
			headerEnd = i + 1;
			break;
		}
		if (headerText.endsWith('end_header\r\n')) {
			headerEnd = i + 1;
			break;
		}
	}
	if (headerEnd === -1) return null;
	if (!headerText.startsWith('ply')) return null;

	const lines = headerText.split(/\r?\n/).map((l) => l.trim());
	let format: PlyHeader['format'] | null = null;
	let current: 'vertex' | 'face' | null = null;
	const vertex = { count: 0, props: [] as PlyProp[] };
	const face = { count: 0, list: null as PlyListProp | null };

	for (const line of lines) {
		if (line.startsWith('format ')) {
			const f = line.split(/\s+/)[1];
			if (f === 'ascii') format = 'ascii';
			else if (f === 'binary_little_endian') format = 'binary_little_endian';
			else if (f === 'binary_big_endian') format = 'binary_big_endian';
		} else if (line.startsWith('element ')) {
			const [, name, count] = line.split(/\s+/);
			if (name === 'vertex') {
				current = 'vertex';
				vertex.count = parseInt(count, 10);
			} else if (name === 'face') {
				current = 'face';
				face.count = parseInt(count, 10);
			} else {
				current = null;
			}
		} else if (line.startsWith('property ')) {
			const parts = line.split(/\s+/);
			if (parts[1] === 'list') {
				if (current === 'face')
					face.list = { countType: parts[2], type: parts[3], name: parts[4] };
			} else if (current === 'vertex') {
				vertex.props.push({ type: parts[1], name: parts[2] });
			}
		}
	}

	if (!format || vertex.count === 0) return null;
	if (face.count === 0) return null;
	return { format, headerLength: headerEnd, vertex, face };
}

type Vec3 = [number, number, number];

function readBody(
	buf: ArrayBuffer,
	header: PlyHeader
): { positions: Vec3[]; faces: [number, number, number][] } {
	const positions: Vec3[] = [];
	const faces: [number, number, number][] = [];

	const xIdx = header.vertex.props.findIndex((p) => p.name === 'x');
	const yIdx = header.vertex.props.findIndex((p) => p.name === 'y');
	const zIdx = header.vertex.props.findIndex((p) => p.name === 'z');
	if (xIdx < 0 || yIdx < 0 || zIdx < 0) return { positions, faces };

	if (header.format === 'ascii') {
		const text = new TextDecoder().decode(new Uint8Array(buf, header.headerLength));
		const tokens = text.split(/\s+/).filter(Boolean);
		const propCount = header.vertex.props.length;
		let pos = 0;
		for (let i = 0; i < header.vertex.count; i++) {
			const row = tokens.slice(pos, pos + propCount);
			pos += propCount;
			positions.push([parseFloat(row[xIdx]), parseFloat(row[yIdx]), parseFloat(row[zIdx])]);
		}
		for (let i = 0; i < header.face.count; i++) {
			const n = parseInt(tokens[pos++], 10);
			const idx = [];
			for (let j = 0; j < n; j++) idx.push(parseInt(tokens[pos++], 10));
			fanTriangulate(idx, faces);
		}
		return { positions, faces };
	}

	const dv = new DataView(buf);
	const littleEndian = header.format === 'binary_little_endian';
	let offset = header.headerLength;

	const sizes: Record<string, number> = {
		char: 1,
		uchar: 1,
		int8: 1,
		uint8: 1,
		short: 2,
		ushort: 2,
		int16: 2,
		uint16: 2,
		int: 4,
		uint: 4,
		int32: 4,
		uint32: 4,
		float: 4,
		float32: 4,
		double: 8,
		float64: 8
	};
	const readers: Record<string, (o: number) => number> = {
		char: (o) => dv.getInt8(o),
		int8: (o) => dv.getInt8(o),
		uchar: (o) => dv.getUint8(o),
		uint8: (o) => dv.getUint8(o),
		short: (o) => dv.getInt16(o, littleEndian),
		int16: (o) => dv.getInt16(o, littleEndian),
		ushort: (o) => dv.getUint16(o, littleEndian),
		uint16: (o) => dv.getUint16(o, littleEndian),
		int: (o) => dv.getInt32(o, littleEndian),
		int32: (o) => dv.getInt32(o, littleEndian),
		uint: (o) => dv.getUint32(o, littleEndian),
		uint32: (o) => dv.getUint32(o, littleEndian),
		float: (o) => dv.getFloat32(o, littleEndian),
		float32: (o) => dv.getFloat32(o, littleEndian),
		double: (o) => dv.getFloat64(o, littleEndian),
		float64: (o) => dv.getFloat64(o, littleEndian)
	};

	for (let i = 0; i < header.vertex.count; i++) {
		const values: number[] = [];
		for (const p of header.vertex.props) {
			values.push(readers[p.type](offset));
			offset += sizes[p.type];
		}
		positions.push([values[xIdx], values[yIdx], values[zIdx]]);
	}

	if (!header.face.list) return { positions, faces };
	const countReader = readers[header.face.list.countType];
	const countSize = sizes[header.face.list.countType];
	const idxReader = readers[header.face.list.type];
	const idxSize = sizes[header.face.list.type];
	for (let i = 0; i < header.face.count; i++) {
		const n = countReader(offset);
		offset += countSize;
		const idx = [];
		for (let j = 0; j < n; j++) {
			idx.push(idxReader(offset));
			offset += idxSize;
		}
		fanTriangulate(idx, faces);
	}
	return { positions, faces };
}

function fanTriangulate(idx: number[], out: [number, number, number][]) {
	for (let i = 1; i < idx.length - 1; i++) out.push([idx[0], idx[i], idx[i + 1]]);
}

function computeVertexNormals(positions: Vec3[], faces: [number, number, number][]): Vec3[] {
	const normals: Vec3[] = positions.map(() => [0, 0, 0]);
	for (const [a, b, c] of faces) {
		const pa = positions[a];
		const pb = positions[b];
		const pc = positions[c];
		if (!pa || !pb || !pc) continue;
		const ex = pb[0] - pa[0],
			ey = pb[1] - pa[1],
			ez = pb[2] - pa[2];
		const fx = pc[0] - pa[0],
			fy = pc[1] - pa[1],
			fz = pc[2] - pa[2];
		const nx = ey * fz - ez * fy;
		const ny = ez * fx - ex * fz;
		const nz = ex * fy - ey * fx;
		normals[a][0] += nx;
		normals[a][1] += ny;
		normals[a][2] += nz;
		normals[b][0] += nx;
		normals[b][1] += ny;
		normals[b][2] += nz;
		normals[c][0] += nx;
		normals[c][1] += ny;
		normals[c][2] += nz;
	}
	for (const n of normals) {
		const len = Math.hypot(n[0], n[1], n[2]) || 1;
		n[0] /= len;
		n[1] /= len;
		n[2] /= len;
	}
	return normals;
}

function writeBinaryLE(
	positions: Vec3[],
	normals: Vec3[],
	faces: [number, number, number][]
): ArrayBuffer {
	const header = [
		'ply',
		'format binary_little_endian 1.0',
		'comment normals computed at upload',
		`element vertex ${positions.length}`,
		'property float x',
		'property float y',
		'property float z',
		'property float nx',
		'property float ny',
		'property float nz',
		`element face ${faces.length}`,
		'property list uchar uint vertex_indices',
		'end_header\n'
	].join('\n');

	const headerBytes = new TextEncoder().encode(header);
	const vertexBytes = positions.length * 6 * 4; // 6 floats * 4 bytes
	const faceBytes = faces.length * (1 + 3 * 4); // 1 byte count + 3 uint32 indices
	const total = headerBytes.length + vertexBytes + faceBytes;

	const out = new ArrayBuffer(total);
	new Uint8Array(out).set(headerBytes, 0);
	const dv = new DataView(out, headerBytes.length);
	let o = 0;
	for (let i = 0; i < positions.length; i++) {
		dv.setFloat32(o, positions[i][0], true);
		o += 4;
		dv.setFloat32(o, positions[i][1], true);
		o += 4;
		dv.setFloat32(o, positions[i][2], true);
		o += 4;
		dv.setFloat32(o, normals[i][0], true);
		o += 4;
		dv.setFloat32(o, normals[i][1], true);
		o += 4;
		dv.setFloat32(o, normals[i][2], true);
		o += 4;
	}
	for (const f of faces) {
		dv.setUint8(o, 3);
		o += 1;
		dv.setUint32(o, f[0], true);
		o += 4;
		dv.setUint32(o, f[1], true);
		o += 4;
		dv.setUint32(o, f[2], true);
		o += 4;
	}
	return out;
}
