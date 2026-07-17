<div align="center">
  <img src="Ephemera%20Logo.png" alt="Ephemera Logo" width="400" />
</div>

# Ephemera

An interactive digital art installation that explores the relationship between movement, stillness, and inevitable decay. Ephemera transforms your camera feed, images, and audio into a living canvas that dissolves when ignored and restores clarity when you interact with it.

## Features

* **Camera Mode**: Stand still and watch your silhouette physically dissolve into 8 distinct glitch styles (Ember, Phantom, Liquid, ASCII, Dust, VHS, Wireframe, Glitch). Wave your hands to sweep away the decay and restore the canvas.
* **AI Silhouette Shield**: Utilizes TensorFlow.js Body Segmentation to map your body and automatically protect your outline from the surrounding decay in real-time.
* **MP3 Oscilloscope Engine**: Upload any audio file and watch the 4-band oscilloscope (Sub-Bass, Low-Mid, High-Mid, Air) distort and break into raw static as it degrades over time. Hover your cursor over a band to restore audio clarity.
* **Image Mode**: A hardware-accelerated grid that allows you to upload high-resolution images and watch them slowly rot away. Sweep your mouse to act as a brush, clearing the rot and revealing the pristine image beneath.
* **Universal Physics Renderers**: Supports 8 totally unique physics and aesthetic styles, ranging from datamosh glitch block-swapping to melting psychedelic liquid.

## Technologies Used

<div align="left">
  <img src="https://img.shields.io/badge/Electron-191970?style=for-the-badge&logo=Electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/p5.js-ED225D?style=for-the-badge&logo=p5.js&logoColor=white" alt="p5.js" />
  <img src="https://img.shields.io/badge/TensorFlow.js-FF6F00?style=for-the-badge&logo=TensorFlow&logoColor=white" alt="TensorFlow.js" />
  <img src="https://img.shields.io/badge/Web%20Audio%20API-000000?style=for-the-badge&logo=JavaScript&logoColor=white" alt="Web Audio API" />
</div>

<br>

## Quick Start (For Judges & Users)

1. Go to the [Releases page](https://github.com/Krshs90/Ephemera/releases/tag/v1.0.0).
2. Scroll to the bottom and click **Assets**.
3. Download **`Ephemera.zip`** (approx 109MB).
4. Right-click the downloaded zip file and select **Extract All...**
5. Open the newly extracted folder and double-click **`Ephemera.exe`** to run the app instantly!

<br>

## Developer Installation

1. Clone this repository.
2. Navigate into the project directory:
   ```bash
   cd Ephemera
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the application:
   ```bash
   npm start
   ```

## Controls

* **Camera**: Move physically to clear decay.
* **MP3**: Hover your cursor horizontally across the 4 frequency rows to restore audio fidelity.
* **Image**: Click and drag your mouse to sweep away visual rot.
* **Spacebar**: Instantly crystallizes (downloads) a snapshot of the current canvas state.

## Credits

* **Core Developer & Designer**: [Krshs90](https://github.com/Krshs90)
* **Readme & Bug Fixes**: Antigravity
