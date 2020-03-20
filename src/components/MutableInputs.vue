<template>
  <form>
    <span class="input-group" v-for="(field, index) of fields" :key="index">
      <span :class="['input-field', `input-${field.type || 'string'}`, field.options ? 'input-pick' : '']">
        <template v-if="!field.options">
            <label :for="`${discrim}:${field.id}`" class="input-name" >{{field.name}}</label>
            <input :id="`${discrim}:${field.id}`" :type="field.type" v-model="controller[field.id]">
        </template>
        <template v-else>
            <span class="input-pick-name">{{field.name}}</span>
            <template v-for="(choice, choiceIndex) of field.options">
                <input type="radio" :id="`${discrim}:${field.id}:${choiceIndex}`" :value="choice" :key="`${discrim}:${field.id}:${choice}:${choiceIndex}`" v-model="controller[field.id]">
                <label :for="`${discrim}:${field.id}:${choiceIndex}`" class="input-name" :key="`${discrim}:${field.id}:${choice}:${choiceIndex}:label`">{{choice}}</label>
            </template>
        </template>
      </span>
      <span class="input-desc" v-if="field.description">{{field.description}}</span>
    </span>
  </form>
</template>

<script lang="ts">
import { Component, Vue, Prop } from "vue-property-decorator";

export interface Field {
  id: string;
  name: string;
  type?: "string" | "number" | "checkbox";
  description?: string;
  options?: any[];
  update?: (val: any) => any;
  value?: () => any;
}

@Component
export default class MutableInputs extends Vue {
  @Prop()
  fields: Field[];

  @Prop({ default: () => ({}) })
  data: any;

  @Prop({ default: () => ({}) })
  changes: any;

  @Prop({ default: Math.random().toString(16)})
  discrim: string;

  controller: any = {};

  created() {
    this.$watch('fields', (fields: Field[]) => {
      fields.forEach(field => {
        Vue.set(this.controller, field.id, field.value ? field.value() : this.data[field.id]);
        this.$watch(`controller.${field.id}`, (newVal, oldValue) => {
          if (newVal === oldValue) return;
          if (field.update) field.update(newVal);
          this.changes[field.id] = newVal;
        }, { deep: true });
      });
    }, { immediate: true });
  }

  fieldWithID(id: string): Field {
    return this.fields.find(field => field.id === id)!;
  }
}
</script>