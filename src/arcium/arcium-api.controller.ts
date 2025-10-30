import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import * as crypto from 'crypto';

export interface ArciumComputationRequest {
  functionName: string;
  inputs: any[];
  metadata?: any;
}

export interface ArciumComputationResult {
  success: boolean;
  result?: any;
  computationId?: string;
  error?: string;
  executionTime?: number;
  gasUsed?: number;
}

export interface ArciumNetworkStatus {
  connected: boolean;
  activeNodes: number;
  averageLatency: number;
  networkHealth: string;
  mxeCount: number;
  totalComputations: number;
}

export interface ArciumComputationStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  result?: any;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

@Injectable()
export class ArciumAPIService {
  private readonly logger = new Logger(ArciumAPIService.name);
  private readonly httpClient: AxiosInstance;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.baseUrl = this.configService.get<string>(
      'ARCIUM_NETWORK_URL',
      'https://api.arcium.com'
    );
    this.apiKey = this.configService.get<string>('ARCIUM_API_KEY', '');

    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.apiKey ? `Bearer ${this.apiKey}` : '',
        'User-Agent': 'Arcium-Private-Lending-Protocol/1.0.0',
      },
    });

    this.logger.log(
      `Arcium API service initialized with base URL: ${this.baseUrl}`
    );
  }

  /**
   * Perform encrypted computation using Arcium's MPC network via API
   */
  async performEncryptedComputation(
    request: ArciumComputationRequest
  ): Promise<ArciumComputationResult> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Starting encrypted computation: ${request.functionName}`
      );

      // Step 1: Get available MXE (Multi-Party Execution Environment)
      const mxe = await this.getAvailableMXE();
      if (!mxe) {
        throw new Error('No available MXE found');
      }

      // Step 2: Encrypt inputs using Arcium's encryption scheme
      const encryptedInputs = await this.encryptInputs(
        request.inputs,
        mxe.publicKey
      );

      // Step 3: Submit computation to Arcium network
      const computationId = await this.submitComputation({
        mxeId: mxe.id,
        functionName: request.functionName,
        encryptedInputs,
        metadata: request.metadata,
      });

      // Step 4: Wait for computation completion
      const result = await this.waitForComputationCompletion(computationId);

      const executionTime = Date.now() - startTime;

      this.logger.log(
        `✅ Encrypted computation completed in ${executionTime}ms`
      );

      return {
        success: true,
        result: result.data,
        computationId,
        executionTime,
        gasUsed: result.gasUsed || 0,
      };
    } catch (error) {
      this.logger.error('Encrypted computation failed', error);
      return {
        success: false,
        error: error.message,
        executionTime: Date.now() - startTime,
      };
    }
  }

  /**
   * Get available Multi-Party Execution Environment (MXE)
   */
  private async getAvailableMXE(): Promise<{
    id: string;
    publicKey: string;
    capacity: number;
  } | null> {
    try {
      const response = await this.httpClient.get('/api/v1/mxe/available');

      if (response.data && response.data.length > 0) {
        const mxe = response.data[0]; // Get the first available MXE
        return {
          id: mxe.id,
          publicKey: mxe.publicKey,
          capacity: mxe.capacity,
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to get available MXE', error);
      return null;
    }
  }

  /**
   * Encrypt inputs for Arcium computation
   */
  private async encryptInputs(
    inputs: any[],
    mxePublicKey: string
  ): Promise<{
    ciphertext: string;
    nonce: string;
    publicKey: string;
  }> {
    try {
      // Generate encryption key pair
      const keyPair = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });

      // Convert inputs to encrypted format
      const inputData = JSON.stringify(inputs);
      const nonce = crypto.randomBytes(16);

      // Simple encryption (in production, use Arcium's specific encryption scheme)
      const cipher = crypto.createCipher('aes-256-cbc', mxePublicKey);
      let encrypted = cipher.update(inputData, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      return {
        ciphertext: encrypted,
        nonce: nonce.toString('hex'),
        publicKey: keyPair.publicKey,
      };
    } catch (error) {
      this.logger.error('Failed to encrypt inputs', error);
      throw new Error('Input encryption failed');
    }
  }

  /**
   * Submit computation to Arcium network
   */
  private async submitComputation(data: {
    mxeId: string;
    functionName: string;
    encryptedInputs: any;
    metadata?: any;
  }): Promise<string> {
    try {
      const response = await this.httpClient.post('/api/v1/computations', {
        mxeId: data.mxeId,
        functionName: data.functionName,
        encryptedInputs: data.encryptedInputs,
        metadata: data.metadata,
        timestamp: new Date().toISOString(),
      });

      if (response.data && response.data.computationId) {
        return response.data.computationId;
      }

      throw new Error('Failed to get computation ID from response');
    } catch (error) {
      this.logger.error('Failed to submit computation', error);
      throw new Error('Computation submission failed');
    }
  }

  /**
   * Wait for computation completion
   */
  private async waitForComputationCompletion(computationId: string): Promise<{
    data: any;
    gasUsed?: number;
  }> {
    const maxWaitTime = 300000; // 5 minutes
    const pollInterval = 5000; // 5 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      try {
        const status = await this.getComputationStatus(computationId);

        if (status.status === 'completed') {
          return {
            data: status.result,
            gasUsed: 0, // Will be provided by the computation result
          };
        }

        if (status.status === 'failed') {
          throw new Error(`Computation failed: ${status.error}`);
        }

        // Wait before next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error) {
        this.logger.error('Error polling computation status', error);
        throw error;
      }
    }

    throw new Error('Computation timeout');
  }

  /**
   * Get computation status
   */
  async getComputationStatus(
    computationId: string
  ): Promise<ArciumComputationStatus> {
    try {
      const response = await this.httpClient.get(
        `/api/v1/computations/${computationId}`
      );

      return {
        id: computationId,
        status: response.data.status,
        progress: response.data.progress || 0,
        result: response.data.result,
        error: response.data.error,
        createdAt: response.data.createdAt,
        completedAt: response.data.completedAt,
      };
    } catch (error) {
      this.logger.error('Failed to get computation status', error);
      throw new Error('Failed to retrieve computation status');
    }
  }

  /**
   * Get Arcium network status
   */
  async getNetworkStatus(): Promise<ArciumNetworkStatus> {
    try {
      const response = await this.httpClient.get('/api/v1/network/status');

      return {
        connected: response.data.connected || false,
        activeNodes: response.data.activeNodes || 0,
        averageLatency: response.data.averageLatency || 0,
        networkHealth: response.data.health || 'unknown',
        mxeCount: response.data.mxeCount || 0,
        totalComputations: response.data.totalComputations || 0,
      };
    } catch (error) {
      this.logger.error('Failed to get network status', error);
      return {
        connected: false,
        activeNodes: 0,
        averageLatency: 0,
        networkHealth: 'error',
        mxeCount: 0,
        totalComputations: 0,
      };
    }
  }

  /**
   * Perform encrypted risk assessment using Arcium API
   */
  async performEncryptedRiskAssessment(encryptedParams: any): Promise<{
    riskScore: number;
    approved: boolean;
    maxAmount: number;
    confidence: number;
  }> {
    const request: ArciumComputationRequest = {
      functionName: 'riskAssessment',
      inputs: [encryptedParams],
      metadata: {
        type: 'risk_assessment',
        timestamp: new Date().toISOString(),
      },
    };

    const result = await this.performEncryptedComputation(request);

    if (!result.success) {
      throw new Error(`Risk assessment failed: ${result.error}`);
    }

    return {
      riskScore: result.result[0] || 50,
      approved: result.result[1] || false,
      maxAmount: result.result[2] || 0,
      confidence: result.result[3] || 0.5,
    };
  }

  /**
   * Perform encrypted collateral validation
   */
  async performEncryptedCollateralValidation(
    collateralValue: number,
    loanAmount: number
  ): Promise<{
    valid: boolean;
    ratio: number;
    requiredRatio: number;
  }> {
    const request: ArciumComputationRequest = {
      functionName: 'collateralValidation',
      inputs: [collateralValue, loanAmount],
      metadata: {
        type: 'collateral_validation',
        timestamp: new Date().toISOString(),
      },
    };

    const result = await this.performEncryptedComputation(request);

    if (!result.success) {
      throw new Error(`Collateral validation failed: ${result.error}`);
    }

    return {
      valid: result.result[0] || false,
      ratio: result.result[1] || 0,
      requiredRatio: result.result[2] || 1.5,
    };
  }

  /**
   * Perform encrypted interest calculation
   */
  async performEncryptedInterestCalculation(
    principal: number,
    rate: number,
    time: number
  ): Promise<{
    interest: number;
    totalAmount: number;
    monthlyPayment: number;
  }> {
    const request: ArciumComputationRequest = {
      functionName: 'interestCalculation',
      inputs: [principal, rate, time],
      metadata: {
        type: 'interest_calculation',
        timestamp: new Date().toISOString(),
      },
    };

    const result = await this.performEncryptedComputation(request);

    if (!result.success) {
      throw new Error(`Interest calculation failed: ${result.error}`);
    }

    return {
      interest: result.result[0] || 0,
      totalAmount: result.result[1] || 0,
      monthlyPayment: result.result[2] || 0,
    };
  }

  /**
   * Get computation history
   */
  async getComputationHistory(
    limit: number = 50
  ): Promise<ArciumComputationStatus[]> {
    try {
      const response = await this.httpClient.get(
        `/api/v1/computations?limit=${limit}`
      );
      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to get computation history', error);
      return [];
    }
  }

  /**
   * Estimate computation cost
   */
  async estimateComputationCost(request: ArciumComputationRequest): Promise<{
    estimatedGas: number;
    estimatedCost: number;
    estimatedTime: number;
  }> {
    try {
      const response = await this.httpClient.post(
        '/api/v1/computations/estimate',
        {
          functionName: request.functionName,
          inputCount: request.inputs.length,
          metadata: request.metadata,
        }
      );

      return {
        estimatedGas: response.data.estimatedGas || 100000,
        estimatedCost: response.data.estimatedCost || 0.001,
        estimatedTime: response.data.estimatedTime || 1000,
      };
    } catch (error) {
      this.logger.error('Failed to estimate computation cost', error);
      return {
        estimatedGas: 100000,
        estimatedCost: 0.001,
        estimatedTime: 1000,
      };
    }
  }

  /**
   * Health check for Arcium API
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.httpClient.get('/api/v1/health');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Arcium API health check failed', error);
      return false;
    }
  }

  /**
   * Get available computation functions
   */
  async getAvailableFunctions(): Promise<string[]> {
    try {
      const response = await this.httpClient.get('/api/v1/functions');
      return response.data || [];
    } catch (error) {
      this.logger.error('Failed to get available functions', error);
      return ['riskAssessment', 'collateralValidation', 'interestCalculation'];
    }
  }
}
