Component({
  properties: {
    imageUrl: {
      type: String,
      value: ""
    },
    src: {
      type: String,
      value: ""
    },
    title: {
      type: String,
      value: ""
    },
    subtitle: {
      type: String,
      value: ""
    },
    badge: {
      type: String,
      value: ""
    },
    placeholder: {
      type: String,
      value: "图片"
    },
    selected: {
      type: Boolean,
      value: false
    },
    showDelete: {
      type: Boolean,
      value: false
    },
    deleteText: {
      type: String,
      value: "×"
    }
  },

  data: {
    loading: false,
    loadFailed: false,
    showImage: false,
    showPlaceholder: true,
    showMeta: false,
    resolvedSrc: "",
    cardClassName: "image-card-comp",
    wrapClassName: "image-wrap placeholder"
  },

  lifetimes: {
    attached() {
      this.syncDisplayState();
    }
  },

  observers: {
    "src,imageUrl": function syncSrc() {
      const resolvedSrc = this.getResolvedSrc();
      this.setData({
        resolvedSrc,
        loading: Boolean(resolvedSrc),
        loadFailed: false
      }, () => {
        this.syncDisplayState();
      });
    },
    "selected,title,subtitle": function sync() {
      this.syncDisplayState();
    }
  },

  methods: {
    getResolvedSrc() {
      return this.properties.imageUrl || this.properties.src || "";
    },

    syncDisplayState() {
      const resolvedSrc = this.getResolvedSrc();
      const hasSrc = Boolean(resolvedSrc);
      const loadFailed = Boolean(this.data.loadFailed);

      this.setData({
        resolvedSrc,
        showImage: hasSrc && !loadFailed,
        showPlaceholder: !hasSrc || loadFailed,
        showMeta: Boolean(this.properties.title || this.properties.subtitle),
        cardClassName: this.properties.selected ? "image-card-comp is-selected" : "image-card-comp",
        wrapClassName: hasSrc && !loadFailed ? "image-wrap" : "image-wrap placeholder"
      });
    },

    onImageLoad() {
      this.setData({
        loading: false,
        loadFailed: false
      }, () => {
        this.syncDisplayState();
      });
    },

    onImageError() {
      this.setData({
        loading: false,
        loadFailed: true
      }, () => {
        this.syncDisplayState();
      });
    },

    onTap() {
      this.triggerEvent("tap");
    },

    onDelete() {
      this.triggerEvent("delete");
    }
  }
});
