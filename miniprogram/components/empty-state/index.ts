Component({
  properties: {
    title: {
      type: String,
      value: "暂无内容"
    },
    description: {
      type: String,
      value: ""
    },
    buttonText: {
      type: String,
      value: ""
    },
    showButton: {
      type: Boolean,
      value: true
    }
  },

  methods: {
    onAction() {
      this.triggerEvent("action");
    }
  }
});
