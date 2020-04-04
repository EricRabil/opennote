<template>
  <div class="editor-ribbon-container">
    <div class="editor-ribbon">
      <template v-for="(tool, id) in topTools">
        <tooltip
          :class="{'ribbon-item': true, active: id === activeTool}"
          :key="id"
          :tooltip="showLabels ? '' : tool.title"
          @click="$emit('switchTool', id)"
        >
          <span class="ribbon-text" v-if="showLabels">{{tool.title}}</span>
          <span class="ribbon-icon" v-html="tool.icon"></span>
        </tooltip>
        <span
          :class="['tools-drawer-slider', !drawerState[id] && 'drawer-closed']"
          :key="`${id}-drawer`"
          v-if="id in drawers"
        >
          <tooltip
            class="drawer-toggle"
            :tooltip="`${drawerState[id] ? 'Close' : 'Open'} ${tool.title}`"
            @click="toggleDrawerState(id)"
          ></tooltip>
          <tooltip
            v-for="sliderTool of drawers[id]"
            :key="sliderTool"
            :class="{'ribbon-item': true, active: sliderTool === activeTool}"
            :tooltip="showLabels ? '' : tools[sliderTool].title"
            @click="$emit('switchTool',sliderTool)"
          >
            <span class="ribbon-text" v-if="showLabels">{{tools[sliderTool].title}}</span>
            <span class="ribbon-icon" v-html="tools[sliderTool].icon"></span>
          </tooltip>
        </span>
      </template>
    </div>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from "vue-property-decorator";
import _ from "@/util";

interface Tool {
  title: string;
  icon: string;
}

@Component
export default class ToolRibbon extends Vue {
  @Prop()
  tools: Tool[];

  @Prop()
  showLabels: boolean;

  @Prop()
  activeTool: string;

  @Prop()
  drawers: {
    [tool: string]: string[];
  };

  drawerState: any = {};

  toggleDrawerState(key: string) {
    Vue.set(this.drawerState, key, !this.drawerState[key]);
  }

  get notInMainToolbox() {
    return Object.values(this.drawers).reduce((a, c) => a.concat(c), []);
  }

  get topTools() {
    return _.filterObject(
      this.tools,
      key => !this.notInMainToolbox.includes(key)
    );
  }
}
</script>

<style lang="scss">
.editor-ribbon-container {
  @extend %bg;
  @extend %text;
  @extend %fill;

  @include schemeResponsive("box-shadow", "shadow-bottom");

  @media print {
    display: none !important;
  }

  z-index: 50;

  user-select: none;

  .editor-ribbon {
    display: flex;
    flex-flow: row;
    flex-wrap: wrap;

    @media only screen and (max-width: 975px) {
      overflow-x: scroll;
      overflow-y: hidden;
      flex-wrap: nowrap;
    }

    & > .tools-drawer-slider {
      display: contents;

      & .drawer-toggle {
        @extend %fill;
        @extend %text;
        display: flex;
        align-items: center;
        padding: 0 5px;

        &::after {
          font-size: 20px;
        }
      }

      &.drawer-closed .drawer-toggle::after {
        content: "\00bb";
      }

      &:not(.drawer-closed) .drawer-toggle::after {
        content: "\00ab";
      }

      &.drawer-closed .ribbon-item {
        display: none;
      }
    }

    & span.ribbon-item,
    & span.drawer-toggle {
      &:hover {
        @extend %bg0;
        cursor: pointer;
      }

      &:active {
        @extend %bg2;
      }

      &.active {
        @extend %bg1;
      }
    }

    & span.ribbon-item {
      display: flex;
      flex-flow: row-reverse;
      padding: 10px 15px;
      height: 22px;
      align-items: center;

      & > span.ribbon-text {
        height: min-content;
        margin-left: 5px;
      }

      & > span.ribbon-icon {
        line-height: 0;
      }
    }
  }
}
</style>