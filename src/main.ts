import "./polyfills";
import "mathquill/build/mathquill.js";
import "./mathquill-patches";
import Vue from 'vue';

const wanker = require('./algebra.worker.ts');
(window as any).AlgebraWorker = new wanker();
(window as any).nerdamer = require('nerdamer');

import Editor from './components/Editor.vue';
import App from './App.vue'
import './registerServiceWorker'
import router from './router'
import store from './store'
import * as math from "mathjs";
import _ from './util';

Vue.config.productionTip = false
Vue.component('editor', Editor);
// console.log(worker);
// Vue.use(worker);

window.MathQuill = MathQuill.getInterface(1);

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
