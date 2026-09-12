// ========== OCL 全局变量映射 ==========
// 将 OpenChemLib 映射到 OCL 全局变量
// 因为 OCL bundle 暴露的是 OpenChemLib，而代码中使用的是 OCL

if (typeof window !== "undefined") {
  // 如果 OpenChemLib 存在但 OCL 不存在，进行映射
  if (typeof window.OpenChemLib !== "undefined" && typeof window.OCL === "undefined") {
    window.OCL = window.OpenChemLib;
    console.log("[Chemfig-SVG] OCL 全局变量已映射: OpenChemLib → OCL");
  }
}
