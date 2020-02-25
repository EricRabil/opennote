import Vue from 'vue'
import Vuex from 'vuex'
import VuexPersistence from 'vuex-persist';
import { OutputData } from '@editorjs/editorjs';

const vuexLocal = new VuexPersistence<any>({
  storage: window.localStorage
});

Vue.use(Vuex)

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const NEW_NOTE_NAME = 'Untitled Note';

export interface Note {
  name: string;
  data: OutputData;
  created: number;
}

export default new Vuex.Store({
  state: {
    currentNote: uuidv4(),
    notes: {

    } as { [id: string]: Note },
    preferences: {
      showLabels: true,
      showToolbox: true,
      hideEditorByDefaultOnMobile: true,
      sawFirstRun: false,
      preferredColorScheme: null,
      defaultNoteName: NEW_NOTE_NAME
    }
  },
  mutations: {
    /**
     * Selects a new note
     */
    setNote(state, id) {
      state.currentNote = id;
    },
    /**
     * Creates a blank note and selects it
     */
    newNote(state, { id, data, name, created } = {}) {
      name = name || state.preferences.defaultNoteName;
      
      const noteName = new RegExp(name);
      const quantifier = new RegExp(/(?:\s\((\d+)\))?/);

      const merged = new RegExp("^" + noteName.source + quantifier.source + "$");

      const clashingNotes: RegExpMatchArray[] = Object.values(state.notes as {[key: string]: Note}).map(note => note.name.match(merged)).filter(n => !!n) as RegExpMatchArray[];

      if (clashingNotes.length > 0) {
        const [ previousMax ] = clashingNotes.map(([,idx]) => parseInt(idx || '0')).sort((a,b) => b - a);
        const nextNumber = previousMax + 1;

        name = `${name} (${nextNumber})`;
      }

      state.notes[id] = {
        data,
        name,
        created: created || Date.now()
      };
    },
    delNote(state, id) {
      const ids = Object.keys(state.notes);
      const index = ids.indexOf(id);
      delete state.notes[id];
    },
    /**
     * Updates a note, or inserts it if it was not present already
     */
    updateNote(state, { data, id, name }) {
      const note = (state.notes[id] || (state.notes[id] = {} as any));
      Vue.set(note, 'data', data || note.data);
      Vue.set(note, 'name', name || note.name || NEW_NOTE_NAME);
    },
    setPreference(state, { name, value }) {
      state.preferences[name] = value;
    }
  },
  actions: {
    newNote(state, { data, name, created } = {}) {
      let id = uuidv4();
      while (state.state.notes[id]) id = uuidv4();
      state.commit('newNote', { id, data, name, created });
      state.commit('setNote', id);
      return id;
    }
  },
  getters: {
    preferredColorScheme: state => {
      return state.preferences.preferredColorScheme;
    },
    currentNote: state => {
      return state.notes[state.currentNote];
    },
    currentNoteName: (state, getters) => {
      return getters.currentNote.name;
    }
  },
  modules: {
  },
  plugins: [vuexLocal.plugin]
})
