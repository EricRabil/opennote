declare module '*.vue' {
  import Vue from 'vue'
  export default Vue
}

declare module '*.svg' {
  const path: string;
  export default path;
}

declare module '*.svg?inline' {
  import Vue from 'vue';
  export default Vue;
}