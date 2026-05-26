import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { bundleAnalyzer } from './src/utils/bundleAnalyzer';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
  plugins: [
    react({
      // Optimize JSX runtime for production
      jsxRuntime: 'automatic',
    }),
    // Enhanced bundle analysis plugin for Raspberry Pi optimization
    {
      name: 'raspberry-pi-bundle-analyzer',
      generateBundle(options, bundle) {
        if (process.env.ANALYZE_BUNDLE === 'true') {
          const bundleStats = {
            chunks: Object.entries(bundle).map(([fileName, chunk]) => ({
              name: fileName,
              size: 'code' in chunk ? chunk.code.length : 0,
              modules: 'modules' in chunk ? Object.keys(chunk.modules || {}) : [],
            })),
            modules: Object.entries(bundle).flatMap(([fileName, chunk]) => 
              'modules' in chunk ? Object.entries(chunk.modules || {}).map(([id, module]) => ({
                name: id,
                size: module.code?.length || 0,
                id,
              })) : []
            ),
          };

          try {
            const analysis = bundleAnalyzer.analyzeBundleForRaspberryPi(bundleStats);
            const report = bundleAnalyzer.generateOptimizationReport(analysis);
            
            // Write analysis report
            this.emitFile({
              type: 'asset',
              fileName: 'bundle-analysis-report.md',
              source: report,
            });

            console.log('\n📊 Bundle Analysis for Raspberry Pi:');
            console.log(`Total Size: ${formatSize(analysis.totalSize)}`);
            console.log(`Gzipped Size: ${formatSize(analysis.gzippedSize)}`);
            console.log(`Recommendations: ${analysis.recommendations.length}`);
            
            if (analysis.recommendations.length > 0) {
              console.log('\n⚠️  Top Recommendations:');
              analysis.recommendations.slice(0, 3).forEach((rec, i) => {
                console.log(`${i + 1}. [${rec.severity.toUpperCase()}] ${rec.description}`);
              });
            }
          } catch (error) {
            console.warn('Bundle analysis failed:', error);
          }
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/store': path.resolve(__dirname, './src/store'),
    },
  },
  build: {
    target: ['es2020', 'chrome80', 'firefox78'], // Optimized for modern browsers including Raspberry Pi
    outDir: 'dist',
    sourcemap: mode === 'development', // Only generate sourcemaps in development
    // Optimize chunk size for Raspberry Pi
    chunkSizeWarningLimit: 400, // Further reduced to 400KB for ARM optimization
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Optimize for ARM architecture
    reportCompressedSize: false, // Disable gzip size reporting to speed up builds
    // ARM-specific build optimizations
    assetsInlineLimit: 2048, // Inline smaller assets to reduce HTTP requests
    // Optimize for slower I/O on Raspberry Pi
    emptyOutDir: true,
    rollupOptions: {
      // Optimize for ARM architecture and slower I/O
      maxParallelFileOps: 1, // Further reduced for Raspberry Pi stability
      // Optimize treeshaking for ARM
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        unknownGlobalSideEffects: false,
        // ARM-specific optimizations
        preset: 'smallest',
      },
      output: {
        // Enhanced code splitting for Raspberry Pi deployment
        manualChunks: (id) => {
          // Vendor chunks - more granular splitting for better caching
          if (id.includes('node_modules')) {
            // React ecosystem - critical, load first
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor';
            }
            // Animation libraries - lazy load these for ARM performance
            if (id.includes('framer-motion')) {
              return 'animations';
            }
            // HTTP client - load early for API calls
            if (id.includes('axios')) {
              return 'http';
            }
            // Date utilities - can be lazy loaded
            if (id.includes('date-fns')) {
              return 'date-utils';
            }
            // State management - load early
            if (id.includes('zustand')) {
              return 'state';
            }
            // Icons - separate chunk for lazy loading on ARM
            if (id.includes('@heroicons')) {
              return 'icons';
            }
            // Testing libraries - exclude from production
            if (id.includes('vitest') || id.includes('@testing-library') || id.includes('fast-check')) {
              return 'test-utils';
            }
            // Performance monitoring - load early for ARM optimization
            if (id.includes('performance') || id.includes('monitor')) {
              return 'performance-vendor';
            }
            // Catch-all for other vendors
            return 'vendor';
          }
          
          // App chunks - organized by feature for better lazy loading
          if (id.includes('/components/')) {
            // Critical UI components (loaded immediately)
            if (id.includes('ErrorDisplay') || id.includes('LoadingDisplay') || id.includes('LoadingSkeleton')) {
              return 'critical-ui';
            }
            // Race-related components (can be lazy loaded)
            if (id.includes('ChickenRace') || id.includes('Tooltip') || id.includes('HoverTooltip')) {
              return 'race-components';
            }
            // Ranking components (can be lazy loaded)
            if (id.includes('DetailedRanking') || id.includes('LazyDetailedRanking')) {
              return 'ranking-components';
            }
            // Navigation and layout components
            if (id.includes('Sidebar') || id.includes('LeaderboardSelector')) {
              return 'navigation-components';
            }
            // Daily code components (can be lazy loaded)
            if (id.includes('DailyCode') || id.includes('DailyGoal')) {
              return 'daily-components';
            }
            // Fullscreen components (lazy load only when needed)
            if (id.includes('Fullscreen')) {
              return 'fullscreen-components';
            }
            // Other components
            return 'ui-components';
          }
          
          // Hooks - separate chunk for better tree shaking
          if (id.includes('/hooks/')) {
            return 'hooks';
          }
          
          // Services - separate chunk for API logic
          if (id.includes('/services/')) {
            return 'services';
          }
          
          // Store - state management logic
          if (id.includes('/store/')) {
            return 'store';
          }
          
          // Utils - utility functions
          if (id.includes('/utils/')) {
            // Performance monitoring utilities - load early for ARM optimization
            if (id.includes('performanceMonitor') || id.includes('resourceOptimizer') || id.includes('raspberryPiProfiler')) {
              return 'performance-utils';
            }
            // Hardware acceleration utilities - load early for ARM
            if (id.includes('hardwareAcceleration') || id.includes('frameRateMonitor')) {
              return 'hardware-utils';
            }
            // Other utilities - can be lazy loaded
            return 'utils';
          }
        },
        // Optimize asset naming for better caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name?.split('.') || [];
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext || '')) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext || '')) {
            return `assets/styles/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',
        // Optimize for ARM architecture - smaller chunks, better caching
        compact: true,
        // ARM-specific optimizations
        generatedCode: {
          preset: 'es2015',
          arrowFunctions: true,
          constBindings: true,
          objectShorthand: true,
        },
      },
      // Tree shaking optimizations - moved to rollupOptions
      // External dependencies that should not be bundled (for CDN loading)
      external: mode === 'production' ? [] : undefined,
    },
    // Enhanced minification for ARM architecture
    minify: 'esbuild',
    // Optimize for ARM architecture
    esbuild: {
      target: 'es2020',
      legalComments: 'none', // Remove comments to reduce bundle size
      treeShaking: true,
      // Optimize for ARM CPU
      minifyIdentifiers: true,
      minifySyntax: true,
      minifyWhitespace: true,
      // ARM-specific optimizations
      platform: 'browser',
      format: 'esm',
      // Optimize for slower ARM parsing
      keepNames: false,
      mangleProps: /^_/,
    },
  },
  // Performance optimizations for Raspberry Pi
  optimizeDeps: {
    // Pre-bundle these dependencies for faster loading
    include: [
      'react',
      'react-dom',
      'zustand',
      'axios',
      'date-fns',
    ],
    // Exclude heavy dependencies that should be lazy loaded
    exclude: [
      '@heroicons/react',
      'framer-motion',
    ],
    // Optimize for ARM architecture
    esbuildOptions: {
      target: 'es2020',
      // ARM-specific optimizations
      platform: 'browser',
      format: 'esm',
    },
    // Force optimization of specific dependencies
    force: mode === 'production',
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
    // Security: Only define environment variables that are safe for client-side exposure
    // Server-side only variables (SUPABASE_SERVICE_ROLE_KEY, GOOGLE_SHEETS_API_KEY, etc.) are intentionally excluded
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
  },
  // Development server optimizations
  server: {
    hmr: {
      overlay: false,
    },
    // Optimize for development on slower hardware
    fs: {
      strict: false,
    },
    // ARM-specific optimizations
    host: true, // Allow external connections for testing on Raspberry Pi
    port: 5173,
    // Optimize for slower hardware
    middlewareMode: false,
  },
  // CSS optimizations
  css: {
    devSourcemap: mode === 'development',
  },
  };
});

// Helper function for bundle size formatting
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}