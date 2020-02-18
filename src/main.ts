import "./polyfills";
import "mathquill/build/mathquill.js";
import "./mathquill-patches";
import Vue from 'vue';

import Editor from './components/Editor.vue';
import App from './App.vue'
import './registerServiceWorker'
import router from './router'
import store from './store'
import * as math from "mathjs";
import _ from './util';

Vue.config.productionTip = false
Vue.component('editor', Editor);

window.MathQuill = MathQuill.getInterface(1);

const fakeElement = document.createElement('div');
const fakeField = new MathQuill.MathField(fakeElement, {});
fakeField.latex('2^2');
(fakeField as any).__controller.root.children().ends[1].__proto__.latex = function() {
  function latex(prefix: any, block: any) {
    var l = block && block.latex();
    return block ? prefix + ('{' + (l || ' ') + '}') : '';
  }
  return (this.sub.trim().length > 0 ? latex('_', this.sub) : '') + (this.sup.trim().length > 0 ? latex('^', this.sup) : '');
}

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
