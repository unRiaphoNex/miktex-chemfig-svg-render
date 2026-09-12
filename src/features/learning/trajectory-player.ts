// ========== 分子轨迹播放器 (v17.4.0) ==========
// 支持多帧轨迹播放（XYZ 格式）
// 播放/暂停/快进/慢放/帧导航

class TrajectoryPlayer {
  constructor(viewer) {
    this.viewer = viewer;
    this.frames = [];
    this.currentFrame = 0;
    this.isPlaying = false;
    this.playSpeed = 1; // 帧间隔倍数
    this.playTimer = null;
  }

  /**
   * 从 XYZ 轨迹文件加载
   */
  loadFromXYZ(text) {
    const lines = text.trim().split("\n");
    this.frames = [];
    let i = 0;

    while (i < lines.length) {
      // 每帧第一行是原子数
      const atomCount = parseInt(lines[i].trim());
      if (isNaN(atomCount) || atomCount <= 0) {
        i++;
        continue;
      }

      // 第二行是注释
      const comment = lines[i + 1] || "";
      i += 2;

      // 读取原子坐标
      const atoms = [];
      for (let j = 0; j < atomCount && i < lines.length; j++) {
        const parts = lines[i].trim().split(/\s+/);
        if (parts.length >= 4) {
          atoms.push({
            element: parts[0],
            x: parseFloat(parts[1]),
            y: parseFloat(parts[2]),
            z: parseFloat(parts[3]),
          });
        }
        i++;
      }

      this.frames.push({
        comment: comment,
        atoms: atoms,
      });
    }

    this.currentFrame = 0;
    
    if (this.frames.length > 0) {
      this.showFrame(0);
    }

    return this.frames.length;
  }

  /**
   * 显示指定帧
   */
  showFrame(frameIndex) {
    if (frameIndex < 0 || frameIndex >= this.frames.length) return;

    this.currentFrame = frameIndex;
    const frame = this.frames[frameIndex];

    // 生成 MOL 文件格式
    const molContent = this.generateMolFromFrame(frame);

    // 加载到查看器
    this.viewer.loadFromMolFile(molContent);
  }

  /**
   * 从帧数据生成 MOL 文件
   */
  generateMolFromFrame(frame) {
    const atomCount = frame.atoms.length;
    const bondCount = 0; // 简化处理，不计算键

    let mol = "";
    mol += frame.comment + "\n";
    mol += "  TrajectoryPlayer\n";
    mol += "\n";
    mol += `${atomCount.toString().padStart(3)}${bondCount.toString().padStart(3)}  0  0  0  0  0  0  0  0999 V2000\n`;

    // 原子坐标
    for (const atom of frame.atoms) {
      mol += `${atom.x.toFixed(4).padStart(10)}${atom.y.toFixed(4).padStart(10)}${atom.z.toFixed(4).padStart(10)} ${atom.element.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0\n`;
    }

    mol += "M  END\n";
    return mol;
  }

  /**
   * 播放
   */
  play(speed = 100) {
    if (this.isPlaying || this.frames.length === 0) return;

    this.isPlaying = true;
    const interval = speed / this.playSpeed;

    this.playTimer = setInterval(() => {
      this.nextFrame();
    }, interval);
  }

  /**
   * 暂停
   */
  pause() {
    this.isPlaying = false;
    if (this.playTimer) {
      clearInterval(this.playTimer);
      this.playTimer = null;
    }
  }

  /**
   * 停止
   */
  stop() {
    this.pause();
    this.currentFrame = 0;
    this.showFrame(0);
  }

  /**
   * 下一帧
   */
  nextFrame() {
    if (this.currentFrame < this.frames.length - 1) {
      this.showFrame(this.currentFrame + 1);
    } else {
      // 循环播放
      this.showFrame(0);
    }
  }

  /**
   * 上一帧
   */
  prevFrame() {
    if (this.currentFrame > 0) {
      this.showFrame(this.currentFrame - 1);
    }
  }

  /**
   * 跳转到指定帧
   */
  gotoFrame(frameIndex) {
    this.showFrame(frameIndex);
  }

  /**
   * 设置播放速度
   */
  setSpeed(speed) {
    this.playSpeed = speed;
    // 如果正在播放，重启计时器
    if (this.isPlaying) {
      this.pause();
      this.play();
    }
  }

  /**
   * 获取总帧数
   */
  getFrameCount() {
    return this.frames.length;
  }

  /**
   * 获取当前帧号
   */
  getCurrentFrame() {
    return this.currentFrame;
  }

  /**
   * 销毁
   */
  destroy() {
    this.pause();
    this.frames = [];
    this.currentFrame = 0;
  }
}

// 导出全局变量
window.TrajectoryPlayer = TrajectoryPlayer;
