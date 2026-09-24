export interface VoyagerItem {
	id: string;
	title?: string;
	titles?: Record<string, string>;
	name?: string;
	tags?: string[];
}
export interface VoyagerTour {
	title?: string;
	titles?: Record<string, string>;
	steps?: { title?: string; titles?: Record<string, string> }[];
}

/** Optional methods cover the supported runtime's public bridge, not arbitrary internals. */
export interface VoyagerElement extends HTMLElement {
	getLanguages?: () => string[];
	getActiveLanguage?: () => string;
	getModels?: () => unknown[];
	getAnnotations?: () => VoyagerItem[];
	getArticles?: () => VoyagerItem[];
	getTours?: () => VoyagerTour[];
	getAnnotationsVisible?: () => boolean;
	setActiveAnnotation?: (id: string) => void;
	setActiveArticle?: (id: string) => void;
	setTourStep?: (tour: number, step: number, interpolate?: boolean) => void;
	setCameraOrbit?: (yaw: number, pitch: number) => void;
	setCameraOffset?: (x: number, y: number, z: number) => void;
	getCameraOrbit?: (type?: string) => unknown;
	getCameraOffset?: (type?: string) => unknown;
	resetViewer?: () => void;
	toggleAnnotations?: () => void;
	toggleReader?: () => void;
	toggleTours?: () => void;
	toggleTools?: () => void;
	toggleMeasurement?: () => void;
	enableAR?: () => void;
	setLanguage?: (code: string) => void;
	setBackgroundStyle?: (style: string) => void;
	setBackgroundColor?: (first: string, second?: string) => void;
}
