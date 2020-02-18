<template>
  <div id="app">
    <router-view/>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { Tooltip } from '@editorjs/editorjs/types/api';

@Component
export default class App extends Vue {
  tooltip: Tooltip = null as any;
}
</script>

<style lang="scss">
body {
  margin: 0;
  font-family: 'Open Sans', sans-serif;
}

.ce-block {
  &.ce-block--focused {
    @include schemeResponsive("background-image", "ce-block--focused");
  }

  .cdx-checklist__item {
    .cdx-checklist__item-checkbox {
      @extend %bgAlt0;
      @extend %border;
    }

    &.cdx-checklist__item--checked {
      .cdx-checklist__item-checkbox {
        background: #388ae5 !important;
      }
    }
  }

  .ce-code__textarea, .ce-rawtool__textarea, .cdx-block.cdx-quote > .cdx-input, .cdx-block.cdx-warning > .cdx-input {
    @extend %bg1;
    @extend %border1;
    @extend %text;
  }

  .cdx-block.tc-editor {
    & > .tc-table__wrap {
      @extend %border1;

      & .tc-table__cell {
        @extend %border1;
      }

      .tc-table tbody tr td:first-child {
        border-left: none;
      }

      .tc-table tbody tr td:first-child, .tc-table tbody tr:first-child td {
        border-top: none;
      }

      .tc-table tbody tr:last-child td {
        border-bottom: none;
      }

      .tc-table tbody tr td:last-child {
        border-right: none;
      }
    }
  }
}

// i hate firefox
[contenteditable]::before {
  content: "\200B" !important;
  display: inline-flex;
}
</style>
