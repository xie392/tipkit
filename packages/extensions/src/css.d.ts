/* 允许在扩展中引入第三方插件的样式文件（如 react-photo-view），
 * 打包器负责处理，vitest 默认将其 stub 为空模块 */
declare module "*.css";
