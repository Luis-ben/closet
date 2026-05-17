"use strict";
Component({
    properties: {
        options: {
            type: Array,
            value: []
        },
        value: {
            type: null,
            value: ""
        },
        multiple: {
            type: Boolean,
            value: false
        },
        max: {
            type: Number,
            value: 0
        }
    },
    data: {
        innerOptions: []
    },
    lifetimes: {
        attached() {
            this.syncOptions();
        }
    },
    observers: {
        "options,value": function sync() {
            this.syncOptions();
        }
    },
    methods: {
        syncOptions() {
            var _a;
            const rawOptions = (_a = this.properties.options) !== null && _a !== void 0 ? _a : [];
            const currentValue = this.properties.value;
            const selectedValues = Array.isArray(currentValue) ? currentValue : [currentValue];
            this.setData({
                innerOptions: rawOptions.map((option) => {
                    const selected = selectedValues.includes(option.value);
                    const classNames = ["tag"];
                    if (selected) {
                        classNames.push("is-selected");
                    }
                    if (option.disabled) {
                        classNames.push("is-disabled");
                    }
                    return Object.assign(Object.assign({}, option), { selected, className: classNames.join(" ") });
                })
            });
        },
        onTapTag(event) {
            const value = event.currentTarget.dataset.value;
            const option = this.properties.options.find((item) => item.value === value);
            if (!option || option.disabled) {
                return;
            }
            if (!this.properties.multiple) {
                this.triggerEvent("change", { value });
                return;
            }
            const currentValue = Array.isArray(this.properties.value) ? [...this.properties.value] : [];
            const exists = currentValue.includes(value);
            let nextValue = exists
                ? currentValue.filter((item) => item !== value)
                : [...currentValue, value];
            if (this.properties.max > 0 && nextValue.length > this.properties.max) {
                nextValue = nextValue.slice(nextValue.length - this.properties.max);
            }
            this.triggerEvent("change", { value: nextValue });
        }
    }
});
