<template>
  <scrollable class="editor-menu-scroll">
    <editor-menu-bar class="editor-menu-bar" :editor="editor" v-slot="{ commands, isActive }">
      <div>
        <spacer></spacer>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.bold() }"
          tooltip="Bold"
          @click="commands.bold"
        >
          <icon name="bold" />
        </ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.italic() }"
          tooltip="Italic"
          @click="commands.italic"
        >
          <icon name="italic" />
        </ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.strike() }"
          tooltip="Strikethrough"
          @click="commands.strike"
        >
          <icon name="strike" />
        </ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.underline() }"
          tooltip="Underline"
          @click="commands.underline"
        >
          <icon name="underline" />
        </ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.code() }"
          tooltip="Code"
          @click="commands.code"
        >
          <icon name="code" />
        </ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.paragraph() }"
          tooltip="Paragraph"
          @click="commands.paragraph"
        >
          <icon name="paragraph" />
        </ui-button>

        <spacer></spacer>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.heading({ level: 1 }) }"
          tooltip="Heading 1"
          @click="commands.heading({ level: 1 })"
        >H1</ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.heading({ level: 2 }) }"
          tooltip="Heading 2"
          @click="commands.heading({ level: 2 })"
        >H2</ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.heading({ level: 3 }) }"
          tooltip="Heading 3"
          @click="commands.heading({ level: 3 })"
        >H3</ui-button>
        
        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.heading({ level: 4 }) }"
          tooltip="Heading 4"
          @click="commands.heading({ level: 4 })"
        >H4</ui-button>
        
        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.heading({ level: 5 }) }"
          tooltip="Heading 5"
          @click="commands.heading({ level: 5 })"
        >H5</ui-button>
        
        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.heading({ level: 6 }) }"
          tooltip="Heading 6"
          @click="commands.heading({ level: 6 })"
        >H6</ui-button>

        <spacer></spacer>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.bullet_list() }"
          tooltip="Unordered List"
          @click="commands.bullet_list"
        >
          <icon name="ul" />
        </ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.ordered_list() }"
          tooltip="Ordered List"
          @click="commands.ordered_list"
        >
          <icon name="ol" />
        </ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.blockquote() }"
          tooltip="Blockquote"
          @click="commands.blockquote"
        >
          <icon name="quote" />
        </ui-button>

        <ui-button
          class="menubar-button no-color"
          color="gray-6"
          :class="{ active: isActive.code_block() }"
          tooltip="Code Block"
          @click="commands.code_block"
        >
          <icon name="code" />
        </ui-button>

        <spacer></spacer>

        <ui-button class="menubar-button no-color" @click="commands.undo" color="gray-6" tooltip="Undo">
          <icon name="undo" />
        </ui-button>

        <ui-button class="menubar-button no-color" @click="commands.redo" color="gray-6" tooltip="Redo">
          <icon name="redo" />
        </ui-button>

        <spacer></spacer>
      </div>
    </editor-menu-bar>
  </scrollable>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { Editor as TipTapEditor, EditorContent, EditorMenuBar } from "tiptap";

interface ToolOptions {
  command: string;
  icon?: string;
}

const ICON_OVERRIDES = {
  ordered_list: "ol",
  bullet_list: "ul",
  blockquote: "quote",
  code_block: "code"
};

@Component({
  components: {
    EditorMenuBar
  }
})
export default class MenuBar extends Vue {
  @Prop()
  editor: TipTapEditor;

  get tools(): ToolOptions[] {
    return Object.keys(this.editor.commands).map(command => ({
      command,
      icon: ICON_OVERRIDES[command]
    }));
  }
}
</script>

<style lang="scss">
.editor-menu-scroll {
  @extend %border-bottom;
}

.editor-menu-bar {
  @include responsiveProperty("background-color", "bg");
  display: flex;
  flex-flow: row;
  margin: 0 auto;
  max-width: 1000px;
  height: $section-height;

  .menubar-button {
    @include responsiveProperty("color", "text", "%v !important");
    padding: 10px;
    border-radius: 0;
    min-width: 14px;

    &:hover {
      @include responsiveProperty("background-color", "gray-5", "", "d2.5");
    }

    &.active {
      @include responsiveProperty("background-color", "gray-5", "", "d5");
      @include border-custom("gray-4", ("top", "bottom"));
      border-top-width: 2px !important;
    }

    &:active {
      @include responsiveProperty("background-color", "gray-5", "", "d7.5");
    }

    svg {
      @extend %fill;
      height: 14px;
      width: 14px;
      flex-shrink: 0;
    }
  }
}
</style>