import { VueConstructor } from "vue/types/umd";
import Actions from "@/uikit/layout/Actions.vue";
import ActionItem from "@/uikit/controls/ActionItem.vue";
import ElementHost from "@/uikit/abstractions/ElementHost.vue";
import ContextMenuController from "@/uikit/controllers/ContextMenuController.vue";
import ModalController from "@/uikit/controllers/ModalController.vue";
import Modal from "@/uikit/layout/Modal.vue";
import UIButton from "@/uikit/controls/UIButton.vue";
import UIButtonTray from "@/uikit/layout/UIButtonTray.vue";
import Scrollable from "@/uikit/layout/Scrollable.vue";
import Drawer from "@/uikit/layout/Drawer.vue";
import DrawerStickySection from "@/uikit/layout/DrawerStickySection.vue";
import DrawerList from "@/uikit/layout/DrawerList.vue";
import Spacer from "@/uikit/layout/Spacer.vue";
import DrawerSectionItem from "@/uikit/layout/DrawerSectionItem.vue";
import SidePiece from "@/uikit/layout/SidePiece.vue";
import ContextMenu from "@/uikit/layout/ContextMenu.vue";
import ConfirmationModal from "@/uikit/modals/ConfirmationModal.vue";
const VTooltip = require("v-tooltip");

export function installUIKit(vue: VueConstructor) {
  vue.component(
    "fade",
    vue.extend({
      functional: true,
      render: (h, { children }) => {
        return h(
          "transition",
          {
            props: {
              mode: "out-in",
              name: "fade",
            },
          },
          children
        )
      },
    })
  );
  
  vue.component("element-host", ElementHost);
  vue.component("context-menu-controller", ContextMenuController);
  vue.component("action-item", ActionItem);
  vue.component("ui-button", UIButton);
  vue.component("ui-button-tray", UIButtonTray);
  vue.component("actions", Actions);
  vue.component("modal-controller", ModalController);
  vue.component("scrollable", Scrollable);
  vue.component("modal", Modal);
  vue.component("drawer", Drawer);
  vue.component("drawer-sticky", DrawerStickySection);
  vue.component("drawer-list", DrawerList);
  vue.component("spacer", Spacer);
  vue.component("drawer-section-item", DrawerSectionItem);
  vue.component("side-piece", SidePiece);
  vue.component("context-menu", ContextMenu);
  vue.component("confirmation-modal", ConfirmationModal);
  vue.use(VTooltip);
}

export type UIColor = "gray-1" | "gray-2" | "gray-3" | "gray-4" | "gray-5" | "gray-6" | "blue" | "green" | "indigo" | "orange" | "pink" | "purple" | "red" | "teal" | "yellow";