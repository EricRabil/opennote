import { Module } from "vuex";
import { LocalState } from ".";
import { NoteModel } from "@/api.sdk";
import _ from "@/util";

interface NotesState {
  currentNote: string;
  notes: NoteModel[];
}

export const notes: Module<NotesState, LocalState> = {
  namespaced: false,
  state: {
    currentNote: _.uuidv4(),
    notes: []
  },
  mutations: {

  },
  actions: {
    
  }
}