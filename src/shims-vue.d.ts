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

declare module '*.svg?data' {
  const bitch: string;
  export default bitch;
}

declare module '*.svg?sprite' {
  const bitch: any;
  export default bitch;
}