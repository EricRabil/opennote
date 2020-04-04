<template>
  <codemirror ref="cmEditor" v-model="code" :options="cmOptions" />
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import { codemirror } from "vue-codemirror";
import { EditorConfiguration } from "codemirror";
import "codemirror/lib/codemirror.css";

interface SavedData {
  mode: string;
  theme: string;
  code: string;
}

@Component({
  components: {
    codemirror
  }
})
export default class CodeMirrorTool extends Vue {
  @Prop()
  savedData: SavedData;

  mode: string = "text";

  theme: string = "cobalt";

  code: string = "";

  $refs: {
    cmEditor: typeof codemirror
  };

  created() {
    for (let unpack of ["mode", "theme", "code"]) {
      Vue.set(this, unpack, this.savedData[unpack] || this[unpack]);
    }

    this.$on("preload", () => {
      this.$emit("setIgnoreBackspace", () => !this.isEmpty);
      this.$emit("setIsEmpty", () => this.isEmpty);
      this.$emit("setIsAtStart", () => this.codemirror.getCursor().line === 0 && this.codemirror.getCursor().ch === 0);
      this.$emit("setIsAtEnd", () => {
        const lineIndex = this.codemirror.lineCount() - 1;
        const isAtLastLine = this.codemirror.getCursor().line === lineIndex;
        const isAtLastCH = this.codemirror.getCursor().ch === (this.codemirror.getLineTokens(lineIndex).length - 1);
        return isAtLastLine && isAtLastCH;
      });
      this.$emit("setSave", () => ({ code: this.code, theme: this.theme, mode: this.mode } as SavedData));

      this.$emit("ready");
    });

    this.$on("setr:code", code => {
      code = new String(code);
      this.streamed = true;
      this.justStreamed = code;
      Vue.set(this, "code", code);
    });

    this.$watch("code", (newCode, oldCode) => {
      if (newCode === this.justStreamed) return;
      if ((typeof oldCode === "object" || typeof newCode === "object") && (newCode.toString() === oldCode.toString())) {
        return;
      }
      this.streamed = false;
    });

    this.$on("get:streamed", resolve => resolve(this.streamed));
  }

  justStreamed: String | null = null;
  streamed: boolean = false;

  get cmOptions(): EditorConfiguration {
    const { mode, theme } = this;
    return {
      mode,
      theme
    };
  }

  get isEmpty() {
    return this.code.length === 0;
  }

  get codemirror(): CodeMirror.Editor {
    return this.$refs.cmEditor.codemirror;
  }
}
</script>