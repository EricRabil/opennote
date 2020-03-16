<template>
  <div :class="['note-selector', readonly && 'readonly']" v-on="$listeners">
    <span class="item-title" :contenteditable="editable" @input="setTitle">{{name}}</span>
    <span class="item-timestamp">{{timestamp}}</span>
  </div>
</template>

<script lang="ts">
import moment from "moment";
import { Component, Prop, Vue } from "vue-property-decorator";
import _ from '../util';
import { NoteModel } from '../api.sdk';

@Component
export default class NoteSelector extends Vue {
  @Prop({ default: false })
  editable: boolean;

  @Prop({ default: false })
  readonly: boolean;

  @Prop()
  note: NoteModel;

  setTitle(event: InputEvent) {
    const target = event.target as HTMLElement;

    const pos = _.Dom.getCaretPosition(target);

    const name = target.innerText.split('\n').join(''),
          id = this.note.id;

    target.innerText = name;

    this.$store.commit("updateNote", {
      id,
      name
    });

    if (this.sdk) {
      this.sdk.editNote(id, { name });
    }

    this.$nextTick(() => {
      console.log('doing the dash like stacey');
      _.Dom.setCurrentCursorPosition(pos, target);
    });
  }

  get sdk() {
    return this.$store.state.dory.sdk;
  }

  get name() {
    return this.note.name;
  }

  get timestamp() {
    const source = this.note.data ? this.note.data.time : this.note.created;
    return moment(source).calendar();
  }
}
</script>

<style lang="scss">
.note-selector {
  display: flex;
  flex-flow: column;
  padding: 10px;

  &.readonly {
    @extend %bg1;
  }

  &:not(.readonly) {
    &:hover {
      @extend %bg1;
      cursor: pointer;
    }

    &:active {
      @extend %bg3;
    }

    &.active {
      @extend %bg2;
    }
  }

  & > .item-title {
  }

  & > .item-timestamp {
    @extend %textAlt;

    padding-top: 5px;
    text-transform: uppercase;
    font-size: 12px;
    text-align: right;
    user-select: none;
  }
}
</style>