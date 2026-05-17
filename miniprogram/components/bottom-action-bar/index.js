"use strict";
Component({
    properties: {
        leftText: {
            type: String,
            value: ""
        },
        buttonText: {
            type: String,
            value: "确定"
        },
        disabled: {
            type: Boolean,
            value: false
        },
        loading: {
            type: Boolean,
            value: false
        },
        loadingText: {
            type: String,
            value: "处理中"
        }
    },
    methods: {
        onAction() {
            if (this.properties.disabled || this.properties.loading) {
                return;
            }
            this.triggerEvent("action");
        }
    }
});
