module.exports = {
  extends: [
    require.resolve('./.eslintrc.json')
  ],
  rules: {
    // Security-specific rules
    'security/detect-buffer-noassert': 'error',
    'security/detect-child-process': 'error',
    'security/detect-disable-mustache-escape': 'error',
    'security/detect-eval-with-expression': 'error',
    'security/detect-no-csrf-before-method-override': 'error',
    'security/detect-non-literal-regexp': 'error',
    'security/detect-non-literal-require': 'error',
    'security/detect-object-injection': 'error',
    'security/detect-possible-timing-attacks': 'error',
    'security/detect-unsafe-regex': 'error',

    // Node.js security rules
    'node/no-deprecated-api': 'error',
    'node/no-extraneous-require': 'error',
    'node/no-missing-require': 'error',
    'node/no-new-require': 'error',
    'node/no-path-concat': 'error',
    'node/no-process-env': 'warn',
    'node/no-process-exit': 'error',
    'node/no-sync': 'warn',
    'node/no-unpublished-bin': 'error',
    'node/process-exit-as-throw': 'error',

    // Disable some rules that might be too strict for this project
    'security/detect-non-literal-fs-filename': 'warn',
    'security/detect-buffer-noassert': 'warn'
  }
};