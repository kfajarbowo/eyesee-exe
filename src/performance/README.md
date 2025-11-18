# Performance Optimization - Phase 1

This directory contains performance optimization modules for the Electron webview application.

## Architecture

```
src/performance/
├── index.js              # Main performance controller
├── memory-manager.js      # Memory management and cleanup
├── performance-monitor.js  # Performance metrics monitoring
├── resource-manager.js     # Resource optimization and cleanup
└── README.md             # This documentation
```

## Phase 1 Features

### 1. Memory Management (`memory-manager.js`)
- **Memory Usage Monitoring**: Continuous monitoring of heap usage
- **Automatic Cleanup**: Triggers cleanup when memory exceeds thresholds
- **Emergency Cleanup**: Aggressive cleanup for critical memory situations
- **Webview Optimization**: Optimizes webview memory usage
- **Cache Management**: Intelligent cache cleanup and management

**Thresholds:**
- Normal: 100MB
- Critical: 150MB
- Cleanup Interval: 30 seconds

### 2. Performance Monitoring (`performance-monitor.js`)
- **Core Web Vitals**: FCP, LCP, FID, CLS monitoring
- **Navigation Timing**: TTFB, DOM content loaded, load complete
- **Resource Monitoring**: Track slow and large resources
- **Error Tracking**: JavaScript errors and unhandled rejections
- **Performance Scoring**: Overall performance score calculation
- **Recommendations**: Automated performance recommendations

**Metrics Tracked:**
- First Contentful Paint (FCP)
- Largest Contentful Paint (LCP)
- First Input Delay (FID)
- Cumulative Layout Shift (CLS)
- Time to First Byte (TTFB)
- Memory usage patterns
- Resource loading performance

### 3. Resource Management (`resource-manager.js`)
- **Resource Optimization**: Automatic optimization of images, scripts, and styles
- **Cache Management**: Intelligent cache cleanup and size management
- **Storage Cleanup**: LocalStorage and SessionStorage cleanup
- **Resource Analysis**: Analysis of resource usage and performance
- **Periodic Cleanup**: Automatic cleanup every 5 minutes

**Optimizations Applied:**
- Lazy loading for images below fold
- Script deferment for non-critical scripts
- Font display optimization
- Resource deduplication
- Cache size limits (50MB max, 1000 items max)

### 4. Performance Controller (`index.js`)
- **Module Coordination**: Coordinates all performance modules
- **Periodic Checks**: Runs periodic performance checks
- **Metrics Collection**: Collects and reports metrics
- **Cleanup Management**: Manages cleanup operations
- **Error Handling**: Centralized error handling

## Usage

### Initialization
```javascript
import { performanceController } from './src/performance/index.js';

// Initialize all performance modules
await performanceController.initialize();

// Get current metrics
const metrics = performanceController.getMetrics();

// Force cleanup
performanceController.forceCleanup();

// Cleanup on application exit
performanceController.destroy();
```

### Keyboard Shortcuts
- **Ctrl+Shift+P**: Show performance report
- **Ctrl+Shift+M**: Force memory cleanup

### Performance Report
The performance report includes:
- Current memory usage
- Performance score (0-100)
- Cache statistics
- Cleanup count
- Recommendations

## Integration

### Main Process (main.js)
- IPC handlers for performance metrics
- Memory management functions
- Resource management functions
- Error reporting

### Preload Script (preload.js)
- Performance monitoring functions
- Memory management functions
- Resource management functions
- Error reporting functions

### Renderer Process (renderer.js)
- Performance module initialization
- Event listener management
- Performance shortcuts
- Performance report display

## Configuration

### Memory Thresholds
```javascript
const memoryThreshold = 100 * 1024 * 1024; // 100MB
const criticalThreshold = 150 * 1024 * 1024; // 150MB
```

### Cache Limits
```javascript
const maxCacheSize = 50 * 1024 * 1024; // 50MB
const maxCacheItems = 1000;
```

### Cleanup Intervals
```javascript
const memoryCleanupInterval = 30000; // 30 seconds
const resourceCleanupInterval = 300000; // 5 minutes
```

## Performance Metrics

### Scoring System
- **A (90-100)**: Excellent performance
- **B (80-89)**: Good performance
- **C (70-79)**: Average performance
- **D (60-69)**: Poor performance
- **F (0-59)**: Very poor performance

### Thresholds
- **FCP**: Good < 1800ms, Poor > 3000ms
- **LCP**: Good < 2500ms, Poor > 4000ms
- **FID**: Good < 100ms, Poor > 300ms
- **CLS**: Good < 0.1, Poor > 0.25
- **TTFB**: Good < 800ms, Poor > 1800ms

## Best Practices

### Memory Management
1. Monitor memory usage regularly
2. Clean up unused event listeners
3. Clear caches periodically
4. Avoid memory leaks in closures
5. Use object pooling for frequently created objects

### Performance Monitoring
1. Track Core Web Vitals
2. Monitor navigation timing
3. Track resource loading performance
4. Monitor JavaScript errors
5. Generate regular performance reports

### Resource Optimization
1. Optimize images (lazy loading, compression)
2. Minimize and bundle JavaScript
3. Use CSS efficiently
4. Implement caching strategies
5. Monitor resource usage

## Future Enhancements (Phase 2)
- Webview preloading and prerendering
- Advanced caching strategies
- Network optimization
- Rendering optimization
- Advanced performance monitoring

## Troubleshooting

### Common Issues
1. **High Memory Usage**: Check for memory leaks, increase cleanup frequency
2. **Slow Performance**: Check resource optimization, analyze performance reports
3. **Frequent Cleanups**: Adjust thresholds, optimize resource usage
4. **Module Initialization Errors**: Check dependencies, verify file paths

### Debug Mode
Enable debug mode by setting:
```javascript
localStorage.setItem('performance-debug', 'true');
```

This will enable detailed logging for all performance modules.

## API Reference

### PerformanceController
- `initialize()`: Initialize all performance modules
- `getMetrics()`: Get current performance metrics
- `forceCleanup()`: Force immediate cleanup
- `destroy()`: Cleanup all modules

### MemoryManager
- `checkMemoryUsage()`: Check current memory usage
- `performCleanup()`: Perform standard cleanup
- `performEmergencyCleanup()`: Perform emergency cleanup
- `getMemoryUsage()`: Get memory usage statistics

### PerformanceMonitor
- `generateReport()`: Generate performance report
- `getCurrentMetrics()`: Get current metrics
- `calculatePerformanceScore()`: Calculate performance score
- `getRecommendations()`: Get performance recommendations

### ResourceManager
- `optimizePageResources()`: Optimize page resources
- `performCleanup()`: Perform resource cleanup
- `analyzeResourceUsage()`: Analyze resource usage
- `getResourceStats()`: Get resource statistics