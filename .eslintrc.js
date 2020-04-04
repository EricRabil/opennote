module.exports = {
  root: true,
  env: {
    browser: true,
    jquery: true
  },
  "extends": [
    "plugin:vue/essential",
    "eslint:recommended",
    "@vue/typescript"
  ],
  rules: {
    "no-console": process.env.NODE_ENV === "production" ? "error" : "off",
    "no-debugger": process.env.NODE_ENV === "production" ? "error" : "off",
    "no-empty": "off",
    "no-cond-assign": "off",
    "no-constant-condition": "off",
    "no-inner-declarations": "off",
    "no-case-declarations": "off",
    "no-dupe-class-members": "off",
    "no-fallthrough": "off",
    "no-useless-escape": "off",
    "@typescript-eslint/no-unused-vars": true,
    "vue/no-unused-components": ["error", {
      "ignoreWhenBindingPresent": true
    }],
    "quotes": [2, "double"],
    "indent": ["error", 2],
    "@typescript-eslint/member-ordering": ["warn", {
      default: [
        // Index signature
        "signature",
      
        // Fields
        "public-static-field",
        "protected-static-field",
        "private-static-field",
        "public-instance-field",
        "protected-instance-field",
        "private-instance-field",
        "public-abstract-field",
        "protected-abstract-field",
        "private-abstract-field",
      
        // Constructors
        "public-constructor",
        "protected-constructor",
        "private-constructor",
      
        // Methods
        "public-static-method",
        "protected-static-method",
        "private-static-method",
        "public-instance-method",
        "protected-instance-method",
        "private-instance-method",
        "public-abstract-method",
        "protected-abstract-method",
        "private-abstract-method",
      ]
    }]
  },
  parserOptions: {
    parser: "@typescript-eslint/parser"
  },
  overrides: [
    {
      files: [
        "**/__tests__/*.{j,t}s?(x)"
      ],
      env: {
        mocha: true
      }
    }
  ]
}
