/**
 * Terrain Provider System - Handles heightmap loading and terrain mesh generation
 */

// Base terrain provider interface
class TerrainProvider {
    getBounds() {
        throw new Error('getBounds() must be implemented');
    }
    
    elevationAt(x, z) {
        throw new Error('elevationAt() must be implemented');
    }
    
    async buildMesh(opts = {}) {
        throw new Error('buildMesh() must be implemented');
    }
}

// Heightmap-based terrain provider
class HeightmapTerrainProvider extends TerrainProvider {
    constructor(config) {
        super();
        this.config = {
            src: 'static/assets/terrain/sample_heightmap.png',
            cell_size: 20,
            base_height: 0,
            vertical_exaggeration: 1.2,
            lod: 'auto',
            ...config
        };
        
        this.heightData = null;
        this.heightmapImage = null;
        this.width = 0;
        this.height = 0;
        this.bounds = {
            minX: 0,
            minZ: 0,
            maxX: 800,
            maxZ: 600
        };
        
        this.canvas = null;
        this.context = null;
    }
    
    async init() {
        try {
            await this.loadHeightmap();
            this.calculateBounds();
        } catch (error) {
            console.warn('Failed to load heightmap, using flat terrain:', error);
            this.createFlatTerrain();
        }
    }
    
    async loadHeightmap() {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                this.heightmapImage = img;
                this.width = img.width;
                this.height = img.height;
                
                // Extract height data from image
                this.extractHeightData();
                resolve();
            };
            
            img.onerror = () => {
                // Try fallback to generated heightmap
                console.warn(`Failed to load heightmap: ${this.config.src}, using generated heightmap`);
                
                // Create a generated heightmap
                const generatedData = HeightmapTerrainProvider.generateSampleHeightmap(128, 128);
                
                const fallbackImg = new Image();
                fallbackImg.onload = () => {
                    this.heightmapImage = fallbackImg;
                    this.width = 128;
                    this.height = 128;
                    this.extractHeightData();
                    resolve();
                };
                
                fallbackImg.onerror = () => {
                    reject(new Error(`Failed to load heightmap: ${this.config.src}`));
                };
                
                fallbackImg.src = generatedData;
            };
            
            // Try to load the heightmap, fallback to procedural if not found
            img.src = this.config.src;
        });
    }
    
    extractHeightData() {
        // Create canvas to read pixel data
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.width;
        this.canvas.height = this.height;
        this.context = this.canvas.getContext('2d');
        
        // Draw image to canvas
        this.context.drawImage(this.heightmapImage, 0, 0);
        
        // Get pixel data
        const imageData = this.context.getImageData(0, 0, this.width, this.height);
        const pixels = imageData.data;
        
        // Convert to height array (assuming grayscale, use red channel)
        this.heightData = new Float32Array(this.width * this.height);
        
        for (let i = 0; i < this.heightData.length; i++) {
            const pixelIndex = i * 4; // RGBA
            const grayValue = pixels[pixelIndex]; // Red channel (0-255)
            
            // Convert to height value
            const normalizedHeight = grayValue / 255;
            this.heightData[i] = this.config.base_height + 
                (normalizedHeight * 100 * this.config.vertical_exaggeration);
        }
    }
    
    createFlatTerrain() {
        // Create simple flat terrain as fallback
        this.width = 64;
        this.height = 64;
        this.heightData = new Float32Array(this.width * this.height);
        
        // Fill with base height
        this.heightData.fill(this.config.base_height);
        
        // Add some gentle procedural variation
        for (let z = 0; z < this.height; z++) {
            for (let x = 0; x < this.width; x++) {
                const index = z * this.width + x;
                const nx = x / this.width;
                const nz = z / this.height;
                
                // Simple Perlin-like noise
                const noise = Math.sin(nx * Math.PI * 4) * Math.cos(nz * Math.PI * 4) * 5;
                this.heightData[index] = this.config.base_height + noise;
            }
        }
    }
    
    calculateBounds() {
        // Calculate world bounds based on cell size
        this.bounds = {
            minX: 0,
            minZ: 0,
            maxX: this.width * this.config.cell_size,
            maxZ: this.height * this.config.cell_size
        };
    }
    
    getBounds() {
        return { ...this.bounds };
    }
    
    elevationAt(x, z) {
        if (!this.heightData) {
            return this.config.base_height;
        }
        
        // Convert world coordinates to heightmap coordinates
        const hx = (x - this.bounds.minX) / (this.bounds.maxX - this.bounds.minX) * (this.width - 1);
        const hz = (z - this.bounds.minZ) / (this.bounds.maxZ - this.bounds.minZ) * (this.height - 1);
        
        // Clamp to bounds
        const clampedX = Math.max(0, Math.min(this.width - 1, hx));
        const clampedZ = Math.max(0, Math.min(this.height - 1, hz));
        
        // Bilinear interpolation for smooth elevation
        const x1 = Math.floor(clampedX);
        const x2 = Math.min(this.width - 1, x1 + 1);
        const z1 = Math.floor(clampedZ);
        const z2 = Math.min(this.height - 1, z1 + 1);
        
        const fx = clampedX - x1;
        const fz = clampedZ - z1;
        
        const h11 = this.heightData[z1 * this.width + x1];
        const h21 = this.heightData[z1 * this.width + x2];
        const h12 = this.heightData[z2 * this.width + x1];
        const h22 = this.heightData[z2 * this.width + x2];
        
        const h1 = h11 * (1 - fx) + h21 * fx;
        const h2 = h12 * (1 - fx) + h22 * fx;
        
        return h1 * (1 - fz) + h2 * fz;
    }
    
    async buildMesh(opts = {}) {
        const options = {
            lod: 'auto',
            wireframe: false,
            ...opts
        };
        
        if (!this.heightData) {
            console.error('No height data available for mesh generation');
            return null;
        }
        
        // Determine mesh resolution based on LOD
        let meshWidth, meshHeight;
        switch (options.lod) {
            case 'low':
                meshWidth = Math.min(32, this.width);
                meshHeight = Math.min(32, this.height);
                break;
            case 'medium':
                meshWidth = Math.min(64, this.width);
                meshHeight = Math.min(64, this.height);
                break;
            case 'high':
                meshWidth = Math.min(128, this.width);
                meshHeight = Math.min(128, this.height);
                break;
            default: // auto
                meshWidth = Math.min(64, this.width);
                meshHeight = Math.min(64, this.height);
        }
        
        // Create geometry
        const geometry = new THREE.PlaneGeometry(
            this.bounds.maxX - this.bounds.minX,
            this.bounds.maxZ - this.bounds.minZ,
            meshWidth - 1,
            meshHeight - 1
        );
        
        // Set vertex heights
        const vertices = geometry.attributes.position.array;
        
        for (let i = 0; i < vertices.length; i += 3) {
            const x = vertices[i] + (this.bounds.maxX - this.bounds.minX) / 2;
            const z = vertices[i + 2] + (this.bounds.maxZ - this.bounds.minZ) / 2;
            
            vertices[i + 1] = this.elevationAt(x, z); // Set Y coordinate
        }
        
        // Update geometry
        geometry.attributes.position.needsUpdate = true;
        geometry.computeVertexNormals();
        
        // Rotate to lie flat (Three.js PlaneGeometry is vertical by default)
        geometry.rotateX(-Math.PI / 2);
        
        // Translate to correct position
        geometry.translate(
            (this.bounds.maxX - this.bounds.minX) / 2,
            0,
            (this.bounds.maxZ - this.bounds.minZ) / 2
        );
        
        // Create material
        const material = this.createTerrainMaterial(options.wireframe);
        
        // Create mesh
        const mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'TerrainMesh';
        mesh.receiveShadow = true;
        
        return mesh;
    }
    
    createTerrainMaterial(wireframe = false) {
        if (wireframe) {
            return new THREE.MeshBasicMaterial({
                color: 0x333333,
                wireframe: true,
                transparent: true,
                opacity: 0.3
            });
        }
        
        // Create a gradient texture based on height
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        
        // Create height-based gradient
        const gradient = ctx.createLinearGradient(0, 0, 256, 0);
        gradient.addColorStop(0, '#1a472a');    // Dark green (low)
        gradient.addColorStop(0.3, '#2d5a3d');  // Medium green
        gradient.addColorStop(0.6, '#4a6741');  // Light green
        gradient.addColorStop(0.8, '#6b5b3a');  // Brown (medium)
        gradient.addColorStop(1, '#8a7c6a');    // Light brown (high)
        
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 256, 1);
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.ClampToEdgeWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        
        return new THREE.MeshLambertMaterial({
            map: texture,
            side: THREE.DoubleSide
        });
    }
    
    // Utility method to generate a sample heightmap for testing
    static generateSampleHeightmap(width = 64, height = 64) {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;
        
        // Generate Perlin-like noise
        for (let z = 0; z < height; z++) {
            for (let x = 0; x < width; x++) {
                const index = (z * width + x) * 4;
                const nx = x / width;
                const nz = z / height;
                
                // Simple noise function
                let value = 0;
                value += Math.sin(nx * Math.PI * 4) * Math.cos(nz * Math.PI * 4) * 0.5;
                value += Math.sin(nx * Math.PI * 8) * Math.cos(nz * Math.PI * 8) * 0.25;
                value += Math.sin(nx * Math.PI * 16) * Math.cos(nz * Math.PI * 16) * 0.125;
                
                // Normalize to 0-255
                const gray = Math.floor((value + 1) * 127.5);
                
                data[index] = gray;     // R
                data[index + 1] = gray; // G
                data[index + 2] = gray; // B
                data[index + 3] = 255;  // A
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }
}

// Tiled terrain provider for large terrains (future enhancement)
class TiledTerrainProvider extends TerrainProvider {
    constructor(config) {
        super();
        this.config = config;
        // TODO: Implement tiled loading
    }
    
    getBounds() {
        // TODO: Implement
        return { minX: 0, minZ: 0, maxX: 1000, maxZ: 1000 };
    }
    
    elevationAt(x, z) {
        // TODO: Implement tile-based lookup
        return 0;
    }
    
    async buildMesh(opts = {}) {
        // TODO: Implement tiled mesh generation
        return null;
    }
}

// Export for global access
window.HeightmapTerrainProvider = HeightmapTerrainProvider;
window.TiledTerrainProvider = TiledTerrainProvider;