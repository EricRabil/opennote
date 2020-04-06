<template>
  <div class="editor-root">
    <menu-bar :editor="editor"></menu-bar>
    <scrollable>
      <editor-content class="editor-content" :editor="editor"></editor-content>
    </scrollable>
  </div>
</template>

<script lang="ts">
import debounce from "debounce";
import { Component, Prop, Vue } from "vue-property-decorator";
import {
  Editor as TipTapEditor,
  EditorContent,
  EditorUpdateEvent,
  EditorFocusUpdateEvent
} from "tiptap";
import MenuBar from "@/components/new-editor/MenuBar.vue";
import {
  Blockquote,
  CodeBlock,
  HardBreak,
  Heading,
  OrderedList,
  BulletList,
  ListItem,
  TodoItem,
  TodoList,
  Bold,
  Code,
  Italic,
  Link,
  Strike,
  Underline,
  History
} from "tiptap-extensions";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { Note } from "../../store";
import RealtimeExtension from "./extensions/RealtimeExtension";

@Component({
  components: {
    EditorContent,
    MenuBar
  }
})
export default class Editor extends Vue {
  editor: TipTapEditor = null!;
  realtimeExtension: RealtimeExtension = null!;

  async mounted() {
    if (!this.note) {
      await this.$store.dispatch("newNote");
    }

    this.$watch("id", () => this.buildRealtimeExtension(true));
    this.$watch("rtcEndpoint", () => this.buildRealtimeExtension(true));

    this.buildRealtimeExtension(true);
  }

  get rtcEndpoint() {
    return this.$store.getters.rtcEndpoint;
  }

  beforeDestroy() {
    this.editor.destroy();
  }

  buildRealtimeExtension(rebuildEditor: boolean = false) {
    if (this.realtimeExtension) {
      this.realtimeExtension.close();
    }
    
    this.realtimeExtension = new RealtimeExtension(
      {
        roomName: this.id!,
        signalingServer: [this.rtcEndpoint || "wss://signaling.yjs.dev"]
      },
      debounce((room: any) => {
        if (!room) return;
        const { bcConns: connections } = room;
        console.log(room);
        if (connections.size > 0) {
          return;
        }
        this.loadEditorContents();
      }, 50),
      data => {
        console.log(data);
      }
    );

    if (rebuildEditor) {
      this.buildEditor();
    }
  }

  loadEditorContents() {
    if (this.note && this.note.data) {
      this.editor.setContent(this.note.data);
    }
  }

  buildEditor() {
    if (this.editor) {
      this.editor.destroy();
    }

    this.editor = new TipTapEditor({
      autoFocus: true,
      useBuiltInExtensions: true,
      extensions: [
        new Blockquote(),
        new CodeBlock(),
        new HardBreak(),
        new Heading({ levels: [1, 2, 3] }),
        new BulletList(),
        new OrderedList(),
        new ListItem(),
        // new TodoItem(),
        // new TodoList(),
        new Bold(),
        new Code(),
        new Italic(),
        new Link(),
        new Strike(),
        new Underline(),
        new History(),
        this.realtimeExtension
      ]
    });

    // if (this.note && this.note.data) {
    //   this.editor.setContent(this.note.data);
    // }

    this.editor.on("update", debounce(this.editorUpdated, 1000));
    this.editor.on("blur", this.editorBlurred as any);
    this.editor.on("focus", this.editorFocused as any);
  }

  editorUpdated({ state, transaction, getJSON }: EditorUpdateEvent) {
    this.save();
  }

  editorBlurred({ event, state, view }: EditorFocusUpdateEvent) {}

  editorFocused({ event, state, view }: EditorFocusUpdateEvent) {}

  save(data = this.editor.getJSON()) {
    const { id } = this;
    return id && this.$store.dispatch("updateNote", { id, data });
  }

  get id(): string | null {
    return (this.note && this.note.id) || null;
  }

  get note(): Note | null {
    return this.$store.getters.currentNote;
  }
}
</script>

<style lang="scss">
.editor-root {
  height: 100vh;
  display: grid;
  grid-template-rows: min-content minmax(0, 1fr);

  .editor-content {
    display: flex;
    flex-flow: column;
    height: 100%;

    .ProseMirror {
      @import "./editor-styles";
      flex-grow: 1;
      outline: none;
      padding: 20px;

      &::before {
        display: none;
      }

      * {
        @extend %text;
        line-height: inherit;
      }
    }
  }
}
</style>