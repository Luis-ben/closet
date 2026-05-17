Component({
  properties: {
    title: {
      type: String,
      value: ""
    },
    description: {
      type: String,
      value: ""
    },
    icon: {
      type: String,
      value: "+"
    },
    url: {
      type: String,
      value: ""
    }
  },

  methods: {
    onTap() {
      if (this.properties.url) {
        wx.navigateTo({
          url: this.properties.url
        });
      }

      this.triggerEvent("action");
    }
  }
});
