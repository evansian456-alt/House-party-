#!/usr/bin/env node
/**
 * PWA Readiness Validator
 * Quick script to validate PWA requirements before deployment
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 PWA Readiness Validator\n');

let errors = 0;
let warnings = 0;
let passes = 0;

function pass(message) {
  console.log(`✅ ${message}`);
  passes++;
}

function fail(message) {
  console.log(`❌ ${message}`);
  errors++;
}

function warn(message) {
  console.log(`⚠️  ${message}`);
  warnings++;
}

// Check manifest.json
console.log('📱 Checking manifest.json...');
try {
  const manifestPath = path.join(__dirname, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  if (manifest.name && manifest.name.length > 0) {
    pass('Manifest has name');
  } else {
    fail('Manifest missing name');
  }

  if (manifest.short_name && manifest.short_name.length > 0) {
    pass('Manifest has short_name');
  } else {
    fail('Manifest missing short_name');
  }

  if (manifest.start_url) {
    pass('Manifest has start_url');
  } else {
    fail('Manifest missing start_url');
  }

  if (manifest.display === 'standalone' || manifest.display === 'fullscreen') {
    pass(`Manifest display mode: ${manifest.display}`);
  } else {
    fail(`Manifest display mode should be standalone or fullscreen, got: ${manifest.display}`);
  }

  const largeIcons = manifest.icons.filter(icon => {
    const size = parseInt(icon.sizes.split('x')[0]);
    return size >= 192;
  });

  if (largeIcons.length > 0) {
    pass(`Found ${largeIcons.length} icon(s) >= 192x192`);
  } else {
    fail('No icons >= 192x192 found');
  }

  const extraLargeIcons = manifest.icons.filter(icon => {
    const size = parseInt(icon.sizes.split('x')[0]);
    return size >= 512;
  });

  if (extraLargeIcons.length > 0) {
    pass(`Found ${extraLargeIcons.length} icon(s) >= 512x512`);
  } else {
    fail('No icons >= 512x512 found');
  }

  if (manifest.theme_color) {
    pass(`Theme color: ${manifest.theme_color}`);
  } else {
    warn('Theme color not defined');
  }

  if (manifest.background_color) {
    pass(`Background color: ${manifest.background_color}`);
  } else {
    warn('Background color not defined');
  }

  // Verify icon files exist
  let iconErrors = 0;
  manifest.icons.forEach(icon => {
    const iconPath = path.join(__dirname, icon.src);
    if (!fs.existsSync(iconPath)) {
      fail(`Icon file missing: ${icon.src}`);
      iconErrors++;
    }
  });

  if (iconErrors === 0) {
    pass(`All ${manifest.icons.length} icon files exist`);
  }

} catch (error) {
  fail(`Failed to read manifest.json: ${error.message}`);
}

// Check service worker
console.log('\n🔧 Checking service-worker.js...');
try {
  const swPath = path.join(__dirname, 'service-worker.js');
  
  if (!fs.existsSync(swPath)) {
    fail('service-worker.js not found');
  } else {
    pass('service-worker.js exists');
    
    const sw = fs.readFileSync(swPath, 'utf8');
    
    if (sw.includes("addEventListener('install'")) {
      pass('Service worker has install event');
    } else {
      fail('Service worker missing install event');
    }

    if (sw.includes("addEventListener('activate'")) {
      pass('Service worker has activate event');
    } else {
      fail('Service worker missing activate event');
    }

    if (sw.includes("addEventListener('fetch'")) {
      pass('Service worker has fetch event');
    } else {
      fail('Service worker missing fetch event');
    }

    if (sw.includes('caches.open')) {
      pass('Service worker implements caching');
    } else {
      fail('Service worker missing caching implementation');
    }

    if (sw.includes('skipWaiting')) {
      pass('Service worker implements skipWaiting');
    } else {
      warn('Service worker should implement skipWaiting for updates');
    }

    if (sw.includes('clients.claim')) {
      pass('Service worker implements clients.claim');
    } else {
      warn('Service worker should implement clients.claim');
    }
  }
} catch (error) {
  fail(`Failed to read service-worker.js: ${error.message}`);
}

// Check index.html
console.log('\n📄 Checking index.html...');
try {
  const indexPath = path.join(__dirname, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  if (html.includes('rel="manifest"')) {
    pass('HTML links to manifest.json');
  } else {
    fail('HTML missing manifest link');
  }

  if (html.includes('name="theme-color"')) {
    pass('HTML has theme-color meta tag');
  } else {
    warn('HTML missing theme-color meta tag');
  }

  if (html.includes('name="viewport"')) {
    pass('HTML has viewport meta tag');
  } else {
    fail('HTML missing viewport meta tag');
  }

  if (html.includes('serviceWorker') && html.includes('register')) {
    pass('HTML registers service worker');
  } else {
    fail('HTML missing service worker registration');
  }

  if (html.includes('apple-touch-icon')) {
    pass('HTML has apple-touch-icon for iOS');
  } else {
    warn('HTML missing apple-touch-icon');
  }

  if (html.includes('name="description"')) {
    pass('HTML has meta description for SEO');
  } else {
    warn('HTML missing meta description');
  }

} catch (error) {
  fail(`Failed to read index.html: ${error.message}`);
}

// Summary
console.log('\n' + '='.repeat(50));
console.log('📊 Summary:');
console.log(`   ✅ Passed: ${passes}`);
console.log(`   ⚠️  Warnings: ${warnings}`);
console.log(`   ❌ Errors: ${errors}`);
console.log('='.repeat(50));

if (errors > 0) {
  console.log('\n❌ PWA readiness check FAILED');
  console.log('   Fix the errors above before deploying.');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n⚠️  PWA readiness check PASSED with warnings');
  console.log('   Consider addressing warnings for best practices.');
  process.exit(0);
} else {
  console.log('\n✅ PWA readiness check PASSED');
  console.log('   Your PWA is ready for deployment!');
  process.exit(0);
}
