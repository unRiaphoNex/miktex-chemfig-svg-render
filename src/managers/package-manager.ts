/**
 * 统一包管理器 - 学习 Excalidraw Plugin 的 PackageManager
 * 
 * 单独管理第三方库的加载，支持弹出窗口
 * 参考: https://github.com/zsviczian/obsidian-excalidraw-plugin
 */

// 已加载的包缓存
const loadedPackages = new Map<string, any>();

/**
 * 包管理器类
 */
class PackageManager {
  /**
   * 加载包
   * @param packageName 包名
   * @param loader 加载函数
   * @returns 加载的包
   */
  static async load<T>(packageName: string, loader: () => Promise<T>): Promise<T> {
    // 检查缓存
    if (loadedPackages.has(packageName)) {
      return loadedPackages.get(packageName);
    }

    console.log(`[PackageManager] Loading ${packageName}...`);
    
    try {
      const pkg = await loader();
      loadedPackages.set(packageName, pkg);
      console.log(`[PackageManager] ${packageName} loaded successfully`);
      return pkg;
    } catch (error) {
      console.error(`[PackageManager] Failed to load ${packageName}:`, error);
      throw error;
    }
  }

  /**
   * 获取已加载的包
   * @param packageName 包名
   * @returns 已加载的包，如果未加载则返回 undefined
   */
  static get<T>(packageName: string): T | undefined {
    return loadedPackages.get(packageName);
  }

  /**
   * 检查包是否已加载
   * @param packageName 包名
   * @returns 是否已加载
   */
  static isLoaded(packageName: string): boolean {
    return loadedPackages.has(packageName);
  }

  /**
   * 卸载包（用于清理）
   * @param packageName 包名
   */
  static unload(packageName: string): void {
    loadedPackages.delete(packageName);
    console.log(`[PackageManager] ${packageName} unloaded`);
  }

  /**
   * 卸载所有包
   */
  static unloadAll(): void {
    loadedPackages.clear();
    console.log(`[PackageManager] All packages unloaded`);
  }

  /**
   * 获取已加载的包列表
   */
  static getLoadedPackages(): string[] {
    return Array.from(loadedPackages.keys());
  }
}

/**
 * OCL (OpenChemLib) 加载器
 */
class OCLLoader {
  private static instance: any = null;

  /**
   * 加载 OCL
   */
  static async load(): Promise<any> {
    return PackageManager.load('ocl', async () => {
      // 检查是否已经全局加载
      if ((window as any).OCL) {
        return (window as any).OCL;
      }

      // 动态加载 OCL bundle
      const oclModule = await import('../../integrations/ocl.bundle.js');
      (window as any).OCL = oclModule.default || oclModule;
      return (window as any).OCL;
    });
  }

  /**
   * 获取 OCL 实例
   */
  static getInstance(): any {
    if (!this.instance) {
      this.instance = PackageManager.get('ocl');
    }
    return this.instance;
  }

  /**
   * 检查 OCL 是否已加载
   */
  static isLoaded(): boolean {
    return PackageManager.isLoaded('ocl');
  }
}

/**
 * 3Dmol.js 加载器
 */
class ThreeDmolLoader {
  private static instance: any = null;

  /**
   * 加载 3Dmol.js
   */
  static async load(): Promise<any> {
    return PackageManager.load('3dmol', async () => {
      // 检查是否已经全局加载
      if ((window as any).$3Dmol) {
        return (window as any).$3Dmol;
      }

      // 动态加载 CDN 脚本
      return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://3Dmol.org/build/3Dmol-min.js';
        script.onload = () => {
          console.log('[3DmolLoader] 3Dmol.js loaded successfully');
          resolve((window as any).$3Dmol);
        };
        script.onerror = (error) => {
          console.error('[3DmolLoader] Failed to load 3Dmol.js:', error);
          reject(new Error('Failed to load 3Dmol.js'));
        };
        document.head.appendChild(script);
      });
    });
  }

  /**
   * 获取 3Dmol 实例
   */
  static getInstance(): any {
    if (!this.instance) {
      this.instance = PackageManager.get('3dmol');
    }
    return this.instance;
  }

  /**
   * 检查 3Dmol 是否已加载
   */
  static isLoaded(): boolean {
    return PackageManager.isLoaded('3dmol');
  }
}

// 导出
export {
  PackageManager,
  OCLLoader,
  ThreeDmolLoader,
};

// 全局变量（兼容旧代码）
(globalThis as any).PackageManager = PackageManager;
(globalThis as any).OCLLoader = OCLLoader;
(globalThis as any).ThreeDmolLoader = ThreeDmolLoader;
