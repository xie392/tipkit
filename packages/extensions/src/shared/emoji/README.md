# shared/emoji

包内共享模块：emoji 数据与检索 API（移植自 yiitap，MIT）。

emoji/（inline 节点 + 建议）与 callout/（图标选择器）共同依赖。
放在 shared/ 而非某个扩展目录内，避免扩展目录之间的隐式跨目录引用；
裁剪时 emoji/ 与 callout/ 需连同本目录一起取舍。
