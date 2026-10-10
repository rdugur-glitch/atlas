// Only actual project assets are globbed. A ChatGPT filename is never treated as an internet URL.
const attachments = import.meta.glob<string>('../../../../../attached_assets/**/ATLAS*.glb', {
  eager: true, query: '?url', import: 'default',
});
const localLibrary = import.meta.glob<string>('/src/assets/**/ATLAS*.glb', {
  eager: true, query: '?url', import: 'default',
});
export const modelSources = [
  ...Object.entries({ ...attachments, ...localLibrary }).map(([path, url]) => ({
    url, name: path.split('/').pop() ?? 'ATLAS_Animated.glb',
  })),
  ...['models/ATLAS_Animated.glb', 'assets/ATLAS_Animated.glb', 'ATLAS_Animated.glb'].map(path => ({
    url: `${import.meta.env.BASE_URL}${path}`, name: 'ATLAS_Animated.glb',
  })),
];
