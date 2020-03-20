import "reset-css";
import "mathquill/build/mathquill.css";
import "@fortawesome/fontawesome-free/js/all.js";
import "@fortawesome/fontawesome-free/css/all.css";
import "./polyfills";
import "d3/d3.js";
import Vue from 'vue';

const jQuery = require('jquery');
const $ = jQuery;
(window as any).$ = $;

const worker = require('./algebra.worker.ts');
(window as any).AlgebraWorker = new worker();

import App from './App.vue'
import './registerServiceWorker'
import router from './router'
import store, { LocalState, LocalStore } from './store'
import _ from './util';
import { ONoteSDK } from './api.sdk';
import { Store } from 'vuex';
import { ONoteSocket } from './socket';
import Tooltip from "@/components/Tooltip.vue";

Vue.use(require('vue-resize-observer'));

Vue.component('tooltip', Tooltip);

Vue.config.productionTip = false;

window.MathQuill = MathQuill.getInterface(1);

window.addEventListener(
  "touchmove",
  function(event) {
      if (typeof (event as any).scale !== "number") return;
      if ((event as any).scale !== 1) {
          event.preventDefault();
      }
  },
  { passive: false }
);

declare module "vue/types/vue" {
  interface Vue {
    $store: LocalStore;
  }
}

function refreshSocket(socket: ONoteSocket) {
  socket.url = null;
  socket.token = null;
  if (!store.state.preferences.backend) return;
  const url = store.state.preferences.backend.split('://')[1];
  socket.url = `ws://${url}`;
  socket.token = store.state.token;
}

store.watch((state, getters) => getters.user, async (user, oldUser) => {
  if (!user) {
    if (store.state.dory.socket) {
      store.state.dory.socket.close();
    }
    return;
  }
  if (user && oldUser && (user.id === oldUser.id)) return;
  if (!store.state.token) {
    store.commit('setToken', await store.state.dory.sdk.createToken());
    return;
  }
});

store.watch((state, getters) => getters.currentNoteID, async (currentNote, oldNote) => {
  const { socket } = store.state.dory;
  if (socket.closed) {
    return;
  }

  if (currentNote === oldNote) return;
  if (currentNote) {
    socket.send({
      action: "subscribe",
      data: {
        note: currentNote
      }
    });
  }
  if (oldNote) {
    socket.send({
      action: "unsubscribe",
      data: {
        note: oldNote
      }
    });
  }
});

store.subscribe(async (mutation, state) => {
  const { sdk } = state.dory;
  if (!sdk) return;
  switch (mutation.type) {
    case "setPreference":
      await sdk.updatePreferences(state.preferences);
  }
});

store.watch((state, getters) => getters.token, () => refreshSocket(store.state.dory.socket));
store.watch((state, getters) => getters.backend, () => refreshSocket(store.state.dory.socket));

new Vue({
  router,
  store,
  render: h => h(App)
}).$mount('#app')
