import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'task-slice',
  web: {
    host: '0.0.0.0',
    port: 3026,
    commands: {
      dev: 'rsbuild dev',
      build: 'rsbuild build',
    },
  },
  permissions: [],
  outdir: 'dist',
  brand: {
    displayName: '한입업무',
    icon: 'https://raw.githubusercontent.com/jino123413/app-logos/master/task-slice.png',
    primaryColor: '#2F6BFF',
    bridgeColorMode: 'basic',
  },
  webViewProps: {
    type: 'partner',
  },
});
