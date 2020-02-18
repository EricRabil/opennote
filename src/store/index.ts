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

export default new Vuex.Store({
  state: {
    currentNote: uuidv4(),
    notes: {

    } as { [id: string]: {
      name: string;
      data: OutputData;
      created: number;
    } }
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
    newNote(state, { data, name, created } = {}) {
      let id = uuidv4();
      while (state.notes[id]) id = uuidv4();
      state.notes[id] = {
        data,
        name: name || NEW_NOTE_NAME,
        created: created || Date.now()
      };
      state.currentNote = id;
    },
    delNote(state, id) {
      const ids = Object.keys(state.notes);
      const index = ids.indexOf(id);
      const newSelected = ids[index - 1] || ids[index + 1] || ids[0];
      delete state.notes[id];
      state.currentNote = newSelected;
    },
    /**
     * Updates a note, or inserts it if it was not present already
     */
    updateNote(state, { data, id, name }) {
      const note = (state.notes[id] || (state.notes[id] = {} as any));
      note.data = data || note.data;
      note.name = name || note.name || NEW_NOTE_NAME;
    }
  },
  actions: {
  },
  modules: {
  },
  plugins: [vuexLocal.plugin]
})
