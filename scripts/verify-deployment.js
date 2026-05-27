#!/usr/bin/env node

/**
 * Deployment Verification Script
 * 
 * This script verifies that the deployment is configured correctly
 * and all necessary files are in place.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

console.log('🔍 Verifying Vercel deployment configuration...\n');

const checks = [
  {
    name: 'vercel.json exists',
    check: () => fs.existsSync(path.join(projectRoot, 'vercel.json')),
    fix: 'Create vercel.json file with proper configuration'
  },
  {
    name: 'package.json has build script',
    check: () => {
      const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
      return pkg.scripts && pkg.scripts.build;
    },
    fix: 'Add "build" script to package.json'
  },
  {
    name: '.env.example exists',
    check: () => fs.existsSync(path.join(projectRoot, '.env.example')),
    fix: 'Create .env.example with required environment variables'
  },
  {
    name: 'DEPLOYMENT.md exists',
    check: () => fs.existsSync(path.join(projectRoot, 'DEPLOYMENT.md')),
    fix: 'Create DEPLOYMENT.md with setup instructions'
  },
  {
    name: 'GitHub Actions workflow exists',
    check: () => fs.existsSync(path.join(projectRoot, '.github/workflows/ci.yml')),
    fix: 'Create .github/workflows/ci.yml for CI/CD pipeline'
  },
  {
    name: '.gitignore excludes sensitive files',
    check: () => {
      const gitignore = fs.readFileSync(path.join(projectRoot, '.gitignore'), 'utf8');
      return gitignore.includes('.env') && gitignore.includes('.vercel');
    },
    fix: 'Update .gitignore to exclude .env and .vercel files'
  },
  {
    name: 'No hardcoded API credentials in source',
    check: () => {
      const srcDir = path.join(projectRoot, 'src');
      if (!fs.existsSync(srcDir)) return true;
      
      const checkFile = (filePath) => {
        const content = fs.readFileSync(filePath, 'utf8');
        const sensitivePatterns = [
          '68a6752b6e1d0e2196db1b53',
          'NjhhNjc1MmI2ZTFkMGUyMTk2ZGIxYjUzOjY3ZWM0ZTRhMjMyN2Y3NGYzYTJmOTZmNQ=='
        ];
        return !sensitivePatterns.some(pattern => content.includes(pattern));
      };
      
      const checkDirectory = (dir) => {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            if (!checkDirectory(filePath)) return false;
          } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
            if (!checkFile(filePath)) return false;
          }
        }
        return true;
      };
      
      return checkDirectory(srcDir);
    },
    fix: 'Remove hardcoded API credentials from source code'
  }
];

let allPassed = true;

checks.forEach((check, index) => {
  const passed = check.check();
  const status = passed ? '✅' : '❌';
  console.log(`${index + 1}. ${status} ${check.name}`);
  
  if (!passed) {
    console.log(`   💡 Fix: ${check.fix}`);
    allPassed = false;
  }
});

console.log('\n' + '='.repeat(50));

if (allPassed) {
  console.log('🎉 All deployment checks passed!');
  console.log('\nNext steps:');
  console.log('1. Push your code to GitHub');
  console.log('2. Connect your repository to Vercel');
  console.log('3. Set environment variables in Vercel dashboard');
  console.log('4. Deploy and test your application');
  process.exit(0);
} else {
  console.log('❌ Some deployment checks failed.');
  console.log('Please fix the issues above before deploying.');
  process.exit(1);
}