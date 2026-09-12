// ========== OCL 全局变量映射 ==========
// 将 OpenChemLib 映射到 OCL 全局变量
// 因为 OCL bundle 暴露的是 OpenChemLib，而代码中使用的是 OCL

// 直接在全局作用域声明 OCL 变量，这样所有使用 OCL.XXX 的地方都能工作
// 注意：必须在全局作用域声明，而不是 window.OCL = ...
// 因为在严格模式下，window.OCL 不会自动创建 OCL 全局变量

if (typeof window !== "undefined") {
  // 如果 OpenChemLib 存在，直接映射到 OCL 全局变量
  if (typeof window.OpenChemLib !== "undefined") {
    // 同时设置 window.OCL 和全局 OCL
    window.OCL = window.OpenChemLib;
    // 使用 eval 在全局作用域声明 OCL（绕过模块作用域）
    (0, eval)('var OCL = window.OpenChemLib;');
    console.log("[Chemfig-SVG] OCL 全局变量已映射: OpenChemLib → OCL");
  }
}
