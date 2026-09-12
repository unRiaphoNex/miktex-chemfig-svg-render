// ========== OCL 全局变量映射 ==========
// 将 OpenChemLib 映射到 OCL 全局变量
// 因为 OCL bundle 暴露的是 OpenChemLib，而代码中使用的是 OCL

// 直接在全局作用域声明 OCL 变量
// 注意：build.js 是文件合并，所有文件在同一个作用域中
// 所以这里的 var OCL 就是全局作用域的 var OCL

var OCL = typeof OpenChemLib !== "undefined" ? OpenChemLib : (typeof window !== "undefined" ? window.OpenChemLib : undefined);

if (OCL) {
  console.log("[Chemfig-SVG] OCL 全局变量已映射: OpenChemLib → OCL");
}

