# Monako Glass Clone — Construction Blueprint

## 1. Component BOM

| Component | Supplier | Price Range | Notes |
|-----------|----------|-------------|-------|
| TR90 Frame | 1688.com suppliers (e.g., 安科超轻TR90眼镜框) | ¥15-30 ($2-4) | Lightweight, flexible TR90 material; available in various colors; search "TR90眼镜框" on 1688.com |
| Waveguide Display Module | Goolton Technology (M2030/M3033) or JBD MicroLED | $20-40 | Goolton M2030/M3033 offers good clarity/weight balance; JBD offers MicroLED option |
| Mainboard/SoC | LOOFII ARGL01 or 展锐W517 solution | $15-25 | LOOFII ARGL01 offers 3.2 TOPS AI computing power; 展锐W517 is China-specific AI glasses solution |
| Bone Conduction Mic | SISTC WBC252-01GD or Upbeat Tech UPM01/UPM02 | $5-15 | Bone-conduction MEMS microphone for clear voice in noisy environments |
| Camera Module | OV2640 or similar MIPI CSI camera | $3-8 | Small footprint MIPI camera module; OV2640 (2MP) common in smart glasses |
| Battery | 100-150mAh flexible Li-Po | $5-10 | Flexible polymer lithium battery to fit temple arms |
| NPU/AI Accelerator | Integrated in SoC (LOOFII ARGL01: 3.2 TOPS) | Included in mainboard | Look for solutions with 0.5+ TOPS for gesture/AI processing |
| Storage/Memory | 4GB RAM + 64GB eMMC (typical) | Included in mainboard | Look for solutions with 4GB+ RAM, 32GB+ storage |
| Battery Management IC | Standard Li-Po protection IC | $0.5-2 | For safe charging/discharging of battery |
| Connectivity | Bluetooth 5.0 + WiFi module | Often integrated in SoC | Ensure BT 5.0+ for audio, WiFi for updates |
| Sensors | IMU (6-axis), proximity sensor | $1-3 | For gesture detection and wear detection |
| Housing/Temple Arms | Custom/TR90 temples | $5-15 | May need custom milling to house components |
| Hinges | Standard eyeglass hinges | $0.5-2 per side | Standard optical hinges |
| Nose Pads | Adjustable silicone nose pads | $1-3 | For comfort and fit |
| Screws/Fasteners | Miniature screws | <$1 | For assembly |
| **Total Estimated BOM** |  | **$70-150** | Depending on component choices and quantities |

## 2. Supplier Details & Links

### Frame Suppliers (1688.com/Alibaba)
- Search terms: "TR90眼镜框", "TR90防蓝光近视眼镜框", "超轻TR90眼镜架"
- Example: 安科超轻TR90眼镜框 - https://detail.1688.com/offer/675872367119.html (~¥19/piece)
- Search for "智能眼镜框架" or "AR眼镜框" for purpose-built smart glass frames

### Mainboard/SoC Suppliers
- **LOOFII ARGL01**: https://e.loofii.com/product/argl01/ (3.2 TOPS, 64GB+4GB RAM)
- **展锐W517 Solution**: Search "AI智能眼镜开发-展锐W517" on Chinese sites like qilinktech.com
- **Alternative**: Rockchip RK3566/RK3562 based solutions (search RK3566智能眼镜方案)

### Display Module Suppliers
- **Goolton Technology**: https://goolton.com/ar-optical-display-module/ (M2030, M3033 waveguide modules)
- **JBD MicroLED**: https://jb-display.com/ (MicroLED displays for AR glasses)
- **Alternative**: Waveguide solutions from firms like DigiLens, WaveOptics (may require MOQs)

### Bone Conduction Mic Suppliers
- **SISTC WBC252-01GD**: https://sistc.com/product/wbc252-01gd-bone-conduction-mems-microphone/
- **Upbeat Technology UPM01/UPM02**: https://www.upbeattechtw.com/products/upbeat-mems
- **Alternative**: Knowles SPH0645LM4H-B (KNOWLES bone conduction mic)

### Camera Module Suppliers
- **OV2640 Modules**: Widely available on AliExpress, AliExpress, LCSC
- Search: "OV2640 MIPI CSI camera module"
- Alternatives: OV5640 (5MP), IMX214 (Sony) for higher quality

### Battery Suppliers
- Search 1688.com/Alibaba for: "柔性锂聚合物电池 100mAh", "柔性电池 150mAh"
- Look for suppliers in Shenzhen/Dongguan area specializing in wearable batteries

### Sourcing Agents (for 1688.com/Alibaba)
- **Superbuy**: https://www.superbuy.com/
- **Pandabuy**: https://www.pandabuy.com/
- **Wegobuy**: https://www.wegobuy.com/
- **CSSBuy**: https://cssbuy.com/
- These services help international buyers purchase from 1688.com/Taobao

### Alternative Sources
- **AliExpress**: Search "AI smart glasses development kit", "AR glasses dev kit"
- **Shenzhen Huaqiangbei**: Electronics markets for components and small quantities
- **Maker Fairs/Shenzhen Markets**: Look for smart glasses reference designs

## 3. Assembly Instructions

### Phase 1: Component Selection & Preparation
1. **Frame Selection**
   - Choose TR90 frame based on facial measurements and style preference
   - Ensure temples have sufficient internal space (≥6mm width, ≥15mm height) for components
   - Purchase extra frames for prototyping/trials

2. **Component Procurement**
   - Order mainboard (LOOFII ARGL01 or equivalent)
   - Select waveguide display module matching mainboard interface (typically MIPI-DSI)
   - Choose bone conduction mic with appropriate connector (often I2S or PDM)
   - Select camera module compatible with mainboard CSI interface
   - Procure flexible battery matching power requirements (~150-200mWh)
   - Order necessary flex cables, connectors, and passive components

3. **Preparation**
   - Create detailed wiring diagram based on chosen components
   - Prepare 3D models or templates for component placement in temples
   - Order any necessary custom flex cables or adapters

### Phase 2: Prototyping & Testing
1. **Electrical Prototyping**
   - Assemble basic circuit on breadboard/perfboard: mainboard, display, camera, mic, battery
   - Verify power requirements and sequencing
   - Test basic functionality: display output, camera capture, mic input
   - Verify bone conduction microphone functionality with test fixture

2. **Mechanical Integration - First Prototypes**
   - Create mock-ups using clay or foam to test component placement in temples
   - Test weight distribution and balance on face
   - Verify temple flexibility doesn't damage flex cables
   - Test nose pad adjustment range with added weight

3. **Integration in Frame**
   - Carefully disassemble donor TR90 frame (heat temples carefully if needed)
   - Route flex cables through temples to hinge area / bridge
   - Mount mainboard in left temple (typically heavier side for balance)
   - Mount display module in frame front, aligned with pupil position
   - Mount camera near bridge or top of frame (privacy consideration: consider indicator LED)
   - Mount bone conduction mic touching temple skin area (typically forward upper temple)
   - Mount battery distributed between temples or in bridge for balance
   - Secure components with appropriate adhesives (double-sided tape, epoxy dots) or small brackets
   - Ensure all flex cables have proper bend radius (>5mm typically)
   - Test assembly intermittently during build to catch wiring issues early

4. **Wiring & Connections**
   - Power: Battery → PMIC → Mainboard
   - Display: Mainboard (MIPI-DSI) → Display Module
   - Camera: Mainboard (CSI) → Camera Module
   - Bone Conduction Mic: Mainboard (I2S/PDM) → Mic Module
   - Sensors: Mainboard (I2C/SPI) → IMU, proximity, etc.
   - Antennas: Route BT/WiFi antennas carefully (often in temples)
   - Use zero-insertion-force (ZIF) connectors where possible for reliability
   - Add strain relief on all flex cables at connection points

### Phase 3: Testing & Iteration
1. **Initial Power-On Test**
   - Verify all power rails correct with multimeter before connecting battery
   - First power-on with current-limited power supply
   - Check for overheating components
   - Verify basic mainboard functionality (LED indicators, etc.)

2. **Functional Testing**
   - Test display output and adjust focus/alignment
   - Test camera image quality and adjust focus if needed
   - Test bone conduction microphone audio quality
   - Test sensor data (IMU for gestures, proximity for wear detection)
   - Verify Bluetooth/WiFi connectivity
   - Test battery life with typical usage pattern

3. **Mechanical Testing**
   - Wear test for comfort over extended periods (30+ min)
   - Test temple flexing doesn't disconnect cables
   - Test stability during head movement
   - Verify nose pads maintain position
   - Check weight distribution (<50g target for comfort)

4. **Iteration**
   - Based on testing, adjust component positions
   - Reinforce weak points with additional adhesive or brackets
   - Optimize cable routing to reduce stress points
   - Consider adding strain relief loops in cables

### Phase 4: Final Assembly
1. **Clean & Prepare**
   - Clean all contact surfaces with isopropyl alcohol
   - Ensure all cables are properly seated and strain-relieved
   - Verify all mechanical fasteners are secure

2. **Final Sealing**
   - Apply small amounts of adhesive to secure critical components
   - Consider conformal coating on PCBs for sweat/moisture resistance (mask connectors)
   - Ensure any openings (mic ports, etc.) remain clear

3. **Final Testing**
   - Complete functional test of all systems
   - Battery life test (target 4+ hours mixed use)
   - Comfort wear test (60+ minutes)
   - Gesture recognition testing
   - Voice command testing via bone conduction mic

4. **Documentation**
   - Create final assembly guide with photos
   - Document any modifications to original frame
   - Create wiring diagram/schematic for future reference
   - Note any tuning parameters (display focus, mic gain, etc.)

## 4. Firmware & Software Setup

### Operating System Options
1. **MonoOS (Monako's OS)**
   - Linux-based with Lua application layer
   - Currently proprietary; monitor Monako's announcements for potential SDK release
   - Alternative: Look for LuoYi or other China smart glasses Linux distributions

2. **Android-Based Options**
   - LOOFII ARGL01 supports Android (per listing)
   - Rockchip RK3562/RK3566 Android solutions common in China smart glasses
   - Consider AOSP build optimized for low power

3. **Linux Embedded Options**
   - Buildroot or Yocto based custom Linux
   - Consider Zephyr RTOS for ultra-low power if full Linux not needed
   - Ubuntu Core or Ubuntu Core 20 for more complex applications
   - Zephyr + LVGL for lightweight GUI

4. **Recommended Approach for Clone**
   - Start with vendor-provided Linux/Android BSP on chosen mainboard
   - Develop custom applications/services for target use cases
   - Consider containerized

### Software Stack Components
1. **Display Server**
   - Wayland/Weston or SurfaceFlinger (Android)
   - Consider lightweight options like LittlevGL (LVGL) or NanoGUI for direct framebuffer

2. **Input System**
   - Gesture recognition: Process IMU data for head gestures, touch sensors for touch input
   - Voice: Process bone conduction mic audio through wake-word detection and speech-to-text
   - Consider integrating with existing voice assistants (Vosk for offline STT, etc.)

3. **Power Management**
   - Implement aggressive power management for all-day wearability
   - Sensor hub for always-on gesture/wake detection
   - Dynamic voltage/frequency scaling based on workload

4. **Connectivity Stack**
   - Bluetooth stack for audio (A2DP for music, HFP/HSP for calls if mic supports)
   - WiFi for updates and occasional cloud offload
   - Consider Bluetooth LE for low-power sensor data

5. **Application Framework**
   - For coding agent focus: Develop Lua/Python bindings for AI agent APIs
   - Consider webview/chromium for web-based interfaces if performance allows
   - Native OpenGL/Vulkan for AR overlays if needed

### Development & Deployment Workflow
1. **Environment Setup**
   - Install cross-compilation toolchain for target SoC (often aarch64-linux-gnu)
   - Set up vendor SDK/BSP according to mainboard documentation
   - Configure build system (Buildroot, Yocto, Android AOSP, etc.)

2. **Application Development**
   - Develop custom services for:
     * Gesture recognition (IMU processing)
     * Voice wake-word detection (bone conduction mic optimized)
     * Display output management (low-power modes)
     * Power management policies
   - Consider using existing frameworks:
     * TensorFlow Lite Micro for gesture recognition on NPU
     * Vosk or PocketSphinx for speech recognition
     * LVGL or Qt for lightweight UI

3. **Deployment & Updates**
   - Create update mechanism (OTA or wired)
   - Develop recovery mechanism for bricked devices
   - Create factory test jig for production units

4. **Specific Features for Monako-like Experience**
   - **Voice-First Interface**: Optimize for bone conduction mic input
   - **Gesture Control**: Implement Vision Engine-like gesture recognition
   - **AI Agent Integration**: Develop connectors for Claude Code, Codex, etc.
   - **Low-Power Display**: Implement aggressive display timeout and brightness control
   - **Privacy Indicators**: LED for camera/mic activation (important for social acceptance)

### Resources & References
1. **Vendor Documentation**
   - LOOFII ARGL01 datasheet and SDK
   - Goolton display module interface specifications
   - SISTC/WBC252-01GD datasheet and application notes
   - Bone conduction mic application notes from vendors

2. **Open Source Projects**
   - **Open Glasses** (https://github.com/opensource-glasses) - Reference designs
   - **OpenGlass** (https://github.com/openglass) - AR glasses platform
   - **RocketGlasses** (https://github.com/rocketglasses) - Open source smart glasses
   - **WebXR Device API** - For web-based AR experiences
   - **Monocular SLAM libraries** (ORB-SLAM2, SVO) for AR applications

3. **Development Boards for Prototyping**
   - Consider starting with development boards before custom integration:
     * LOOFII development kit (if available)
     * Rockchip RK3566/RK3562 eval kits
     * ESP32-S3 based vision boards (for simpler use cases)
     * Raspberry Pi Zero W + miniature display (for proof of concept)

### Security & Privacy Considerations
1. **Secure Boot**: Implement if hardware supports to prevent tampering
2. **Data Encryption**: Encrypt sensitive data at rest
3. **Mic/Camera Indicators**: Physical LED for transparency
4. **Data Minimization**: Process audio/video locally when possible
5. **Secure Updates**: Signed OTA updates to prevent malicious firmware

## 5. Cost Estimate

| Component | Low Estimate | High Estimate | Notes |
|-----------|--------------|---------------|-------|
| TR90 Frame | $2 | $4 | Basic TR90 frame |
| Waveguide Display | $20 | $40 | Goolton/JBD modules |
| Mainboard/SoC | $15 | $25 | LOOFII ARGL01 or equivalent |
| Bone Conduction Mic | $5 | $15 | SISTC or Upbeat Tech |
| Camera Module | $3 | $8 | OV2640 or similar |
| Battery | $5 | $10 | 100-150mAh flexible Li-Po |
| Sensors (IMU, etc.) | $2 | $5 | 6-axis IMU + proximity |
| Passives/Cables/Connectors | $3 | $8 | Flex cables, connectors, resistors, capacitors |
| Assembly/Housing | $5 | $15 | Adhesives, brackets, potential custom milling |
| **Subtotal (Components)** | **$60** | **$130** |  |
| **Development/Prototyping** | $50 | $100 | Extra frames, tools, test equipment |
| **Tools & Equipment** | $20 | $50 | Soldering equipment, tools (if not already owned) |
| **Total Estimated Cost** | **$130** | **$280** | First prototype including development |
| **Estimated Production Cost (10+ units)** | **$80** | **$150** | Excluding development/NRE costs |

*Note: Actual costs vary significantly based on quantities, supplier negotiations, and specific component choices.*

## 6. Challenges & Alternatives

### Technical Challenges
1. **Thermal Management**
   - Challenge: Dense component packing in temples limits heat dissipation
   - Mitigation: Use low-power components, thermal vias/tape to frame, duty-cycling

2. **Battery Life vs. Features**
   - Challenge: Balancing processing power (for AI/Agents) with all-day battery life
   - Alternatives: 
     * Offload heavy processing to phone/cloud
     * Use aggressive power cycling
     * Consider e-ink display for always-on info (lower power but limited refresh)

3. **Display Alignment & Comfort**
   - Challenge: Precise pupil alignment needed for waveguide displays; weight distribution critical
   - Alternatives:
     * Consider lighter near-eye displays (though often less bright)
     * Explore optical designs with larger eye-box for more forgiveness
     * Front-weighted designs with counterbalance in temple tips

4. **Bone Conduction Mic Effectiveness**
   - Challenge: Achieving clear voice pickup in noisy environments while maintaining comfort
   - Alternatives:
     * Array mic with beamforming (more complex)
     * Directional mic near mouth (less aesthetically pleasing)
     * Bone conduction mic optimized for specific frequency ranges

5. **Gesture Recognition Reliability**
   - Challenge: Distinguishing intentional gestures from natural head movement
   - Alternatives:
     * Touch sensors on temples
     * Physical button (though less seamless)
     * Voice wake-word as primary input, gestures for secondary commands

### Supply Chain Challenges
1. **Component Availability**
   - Challenge: Some specialized components (waveguide displays, specific bone conduction mics) may have MOQs or long lead times
   - Mitigation:
     * Start with more available components (e.g., LCD microdisplays) for prototyping
     * Build relationships with suppliers early
     * Consider alternative form factors (e.g., monocle-style) if binocular proves difficult

2. **Quality & Consistency**
   - Challenge: Variations in component quality, especially when sourcing from multiple suppliers
   - Mitigation:
     * Order samples from multiple suppliers before committing
     * Implement incoming quality checks
     * Design for tolerances in critical dimensions

### Alternative Approaches
1. **Modular Approach**
   - Instead of fully integrated glasses, consider:
     * Separate compute module (pendant/clip) connected via thin cable to glasses
     * This allows easier upgrades/repairs and better thermal management
     * Trade-off: Slightly less seamless experience

2. **Different Display Technologies**
   - Waveguide vs. alternatives:
     * **Birdbath optics**: Simpler alignment but bulkier
     * **Free-form prisms**: Good eye-box but can be expensive
     * **Near-eye LCD/OLED**: Simpler optics but requires focusing elements
     * **Laser beam scanning**: Novel but can be expensive/safety considerations

3. **Different Interaction Modalities**
   - Instead of/reducing reliance on gesture/voice:
     * **Eye tracking**: For selection and navigation (adds cost/complexity)
     * **Physical controls**: Minimal touch sensors or buttons on frame
     * **Phone companion**: Offload UI to smartphone, glasses as display only

4. **Different Use Case Focus**
   - Rather than general-purpose AI coding companion:
     * **Navigation-focused**: Emphasize audio prompts, simple visual cues
     * **Translation-focused**: Optimize for microphone quality and display text
     * **Notification-focused**: Simple alerts and glances, minimal interaction
     * **Health/focus**: Biometric sensing, posture reminders, break notifications

### Regulatory & Safety Considerations
1. **Eye Safety**
   - Ensure display emissions are within safe limits (IEC 62471)
   - Avoid blue light hazards, especially for extended use

2. **Radio Compliance**
   - Bluetooth/WiFi modules must have appropriate certifications (FCC, CE, etc.)
   - Consider using pre-certified modules to simplify compliance

3. **Medical Device Considerations**
   - If making health claims, may fall under medical device regulations
   - General wellness claims typically have lower barriers

4. **Data Privacy Regulations**
   - Consider GDPR, CCPA if handling personal data
   - On-device processing helps mitigate privacy concerns

### Recommended Development Path
1. **Phase 1: Proof of Concept (Weeks 1-4)**
   - Start with development board (e.g., Rockchip RK3562 EVB)
   - Add miniature display and camera
   - Prove basic concept: display output, camera input, simple interaction

2. **Phase 2: Integrated Prototyping (Weeks 5-12)**
   - Procure initial components for glasses integration
   - Build first integrated prototype in modified TR90 frame
   - Focus on basic functionality: see-through display, simple UI

3. **Phase 3: Refinement & Features (Weeks 13-20)**
   - Improve ergonomics and weight distribution
   - Implement core features: gesture control, voice input via bone conduction
   - Optimize power management for target battery life

4. **Phase 4: Polishing & Documentation (Weeks 21-24)**
   - Refine mechanical design for comfort and durability
   - Complete software stack for target use case (AI coding companion)
   - Create comprehensive build documentation
   - Consider small batch production for field testing

This blueprint provides a comprehensive starting point for creating a Monako Glass-inspired smart glasses device. Success will require iterative prototyping, careful attention to ergonomics and thermal management, and thoughtful selection of components based on the specific use case priorities.