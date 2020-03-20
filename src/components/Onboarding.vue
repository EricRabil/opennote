<template>
    <div class="onboarding-view">
        <h2>Welcome to OpenNote.</h2>
        <p>OpenNote can:</p>
        <ul>
            <li>Solve algebraic expressions</li>
            <li>Take rich notes with intuitive keyboard shortcuts</li>
            <li>React to your dark mode preferences</li>
            <li>Easily export and import your notes</li>
            <li><i>and so much more</i></li>
        </ul>
        <h3>Ready to play?</h3>
    </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";

@Component
export default class Onboarding extends Vue {
    mounted() {
        this.$root.$emit('modal-patch', { customClasses: ['modal-onboarding', 'modal-fullscreen'] })
    }
}
</script>

<style lang="scss">
.onboarding-view {
    h2, h3, p {
        line-height: 1rem;
        font-weight: 300;
        text-align: center;
    }

    h2 {
        font-size: 20px;
        margin-bottom: 10px;
    }

    h3 {
        margin-top: 10px;
        font-size: 18px;
    }

    ul {
        margin: 10px;
        text-align: center;
        font-style: italic;
    }

    margin-bottom: 10px;
}

.modal-onboarding {
    .modal-header {
        h1 {
            font-size: 30px !important;
            font-weight: bold !important;
            text-align: center;
            width: 100%;
        }
    }

    .modal-footer {
        justify-content: center;
    }
}
</style>