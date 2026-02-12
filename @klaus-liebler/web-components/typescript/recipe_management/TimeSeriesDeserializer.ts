import type { TimeSeriesDataDto, SensorTimeSeriesDto, TimeSeriesPointDto } from './types';

/**
 * @brief Hardware-agnostic binary TimeSeries deserializer
 * 
 * Decodes Base64-encoded binary TimeSeries data from the backend into TypeScript objects.
 * 
 * Binary Format (matching backend TimeSeriesSerializer.cc):
 * - Magic Number: 0x54535244 ("TSRD") - 4 bytes
 * - Version: 1 - 1 byte
 * - Series Count: N - 4 bytes
 * - For each series:
 *   - Sensor Name: length (4 bytes) + UTF-8 string
 *   - Unit: length (4 bytes) + UTF-8 string
 *   - Point Count: M - 4 bytes
 *   - For each point:
 *     - Timestamp: uint64 (8 bytes) - relative to execution start
 *     - Value: float32 (4 bytes)
 * 
 * All multi-byte values use little-endian byte order.
 */
export class TimeSeriesDeserializer {
    private static readonly MAGIC_NUMBER = 0x54535244;  // "TSRD"
    private static readonly EXPECTED_VERSION = 1;
    
    /**
     * @brief Deserialize Base64-encoded binary data to TimeSeriesDataDto
     * @param base64 Base64-encoded binary data from backend
     * @param executionId Execution identifier
     * @param startTime Execution start time (Unix timestamp in milliseconds)
     * @returns Deserialized TimeSeries data
     * @throws Error if magic number is invalid or data is corrupted
     */
    static deserialize(base64: string, executionId: string, startTime: number): TimeSeriesDataDto {
        // Step 1: Decode Base64 to binary
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        console.log(`[TimeSeriesDeserializer] Decoded ${base64.length} chars Base64 → ${bytes.length} bytes binary`);
        
        // Handle empty data (no sensor data recorded)
        if (bytes.length === 0 || base64.length === 0) {
            console.log(`[TimeSeriesDeserializer] No timeseries data available (empty), returning empty dataset`);
            return {
                executionId,
                series: []
            };
        }
        
        // Step 2: Parse binary data
        const view = new DataView(bytes.buffer);
        let pos = 0;
        
        // Validate magic number (file format identifier)
        if (bytes.length < 9) {
            throw new Error(`TimeSeries data too short: ${bytes.length} bytes (minimum 9 required)`);
        }
        
        const magic = view.getUint32(pos, true);  // little-endian
        pos += 4;
        
        if (magic !== this.MAGIC_NUMBER) {
            throw new Error(
                `Invalid TimeSeries format: magic=0x${magic.toString(16).toUpperCase()} ` +
                `(expected 0x${this.MAGIC_NUMBER.toString(16).toUpperCase()})`
            );
        }
        
        // Read version
        const version = view.getUint8(pos);
        pos += 1;
        
        if (version !== this.EXPECTED_VERSION) {
            console.warn(`[TimeSeriesDeserializer] Version mismatch: got ${version}, expected ${this.EXPECTED_VERSION}`);
        }
        
        // Read series count
        const seriesCount = view.getUint32(pos, true);
        pos += 4;
        
        console.log(`[TimeSeriesDeserializer] Format valid: version=${version}, seriesCount=${seriesCount}`);
        
        const series: SensorTimeSeriesDto[] = [];
        
        // Read each sensor time series
        for (let i = 0; i < seriesCount; i++) {
            // Read sensor name
            const nameLen = view.getUint32(pos, true);
            pos += 4;
            const nameBytes = new Uint8Array(bytes.buffer, pos, nameLen);
            const sensorName = new TextDecoder().decode(nameBytes);
            pos += nameLen;
            
            // Read unit
            const unitLen = view.getUint32(pos, true);
            pos += 4;
            const unitBytes = new Uint8Array(bytes.buffer, pos, unitLen);
            const unit = new TextDecoder().decode(unitBytes);
            pos += unitLen;
            
            // Read data points
            const pointCount = view.getUint32(pos, true);
            pos += 4;
            
            const dataPoints: TimeSeriesPointDto[] = [];
            
            for (let j = 0; j < pointCount; j++) {
                // Read relative timestamp (relative to execution start)
                const relativeTimestamp = Number(view.getBigUint64(pos, true));
                pos += 8;
                
                // Read value
                const value = view.getFloat32(pos, true);
                pos += 4;
                
                // Convert relative timestamp to absolute Unix timestamp
                const absoluteTimestamp = startTime + relativeTimestamp;
                
                dataPoints.push({
                    timestamp: absoluteTimestamp,
                    value: value
                });
            }
            
            console.log(`[TimeSeriesDeserializer] Sensor ${i+1}/${seriesCount}: "${sensorName}" (${unit}) - ${pointCount} points`);
            
            series.push({
                sensorName,
                unit,
                dataPoints
            });
        }
        
        // Validate that we consumed all bytes
        if (pos !== bytes.length) {
            console.warn(
                `[TimeSeriesDeserializer] Warning: ${bytes.length - pos} bytes remaining ` +
                `(read ${pos}/${bytes.length} bytes)`
            );
        }
        
        console.log(`[TimeSeriesDeserializer] Successfully deserialized ${series.length} sensors`);
        
        return {
            executionId,
            series
        };
    }
    
    /**
     * @brief Check if data appears to be in binary format (Base64-encoded)
     * @param data String to check
     * @returns true if data looks like Base64
     */
    static isBinaryFormat(data: string): boolean {
        // Base64 uses A-Z, a-z, 0-9, +, /, = (padding)
        // Simple heuristic: if it contains these chars and no spaces/newlines at start
        const base64Pattern = /^[A-Za-z0-9+/]+=*$/;
        return base64Pattern.test(data.substring(0, Math.min(100, data.length)));
    }
}
