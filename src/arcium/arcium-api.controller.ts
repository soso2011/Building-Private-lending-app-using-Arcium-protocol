import {
  Controller,     
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import {
  ArciumAPIService,
  ArciumComputationRequest,
  ArciumComputationResult,
} from './arcium-api.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

export class EncryptedComputationDto {
  functionName: string;
  inputs: any[];
  metadata?: any;
}

export class RiskAssessmentDto {
  encryptedParams: any;
}

export class CollateralValidationDto {
  collateralValue: number;
  loanAmount: number;
}

export class InterestCalculationDto {
  principal: number;
  rate: number;
  time: number;
}

@ApiTags('arcium-api')
@Controller('arcium/api')
export class ArciumAPIController {
  constructor(private readonly arciumAPIService: ArciumAPIService) {}

  @Post('compute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perform encrypted computation using Arcium MPC API',
  })
  @ApiBody({ type: EncryptedComputationDto })
  @ApiResponse({
    status: 200,
    description: 'Computation completed successfully',
  })
  async performEncryptedComputation(
    @Body() request: ArciumComputationRequest
  ): Promise<ArciumComputationResult> {
    return this.arciumAPIService.performEncryptedComputation(request);
  }

  @Post('risk-assessment')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perform encrypted risk assessment via Arcium API' })
  @ApiBody({ type: RiskAssessmentDto })
  @ApiResponse({ status: 200, description: 'Risk assessment completed' })
  async performEncryptedRiskAssessment(@Body() data: RiskAssessmentDto) {
    return this.arciumAPIService.performEncryptedRiskAssessment(
      data.encryptedParams
    );
  }

  @Post('collateral-validation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perform encrypted collateral validation via Arcium API',
  })
  @ApiBody({ type: CollateralValidationDto })
  @ApiResponse({ status: 200, description: 'Collateral validation completed' })
  async performEncryptedCollateralValidation(
    @Body() data: CollateralValidationDto
  ) {
    return this.arciumAPIService.performEncryptedCollateralValidation(
      data.collateralValue,
      data.loanAmount
    );
  }

  @Post('interest-calculation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Perform encrypted interest calculation via Arcium API',
  })
  @ApiBody({ type: InterestCalculationDto })
  @ApiResponse({ status: 200, description: 'Interest calculation completed' })
  async performEncryptedInterestCalculation(
    @Body() data: InterestCalculationDto
  ) {
    return this.arciumAPIService.performEncryptedInterestCalculation(
      data.principal,
      data.rate,
      data.time
    );
  }

  @Get('computation/:computationId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get computation status from Arcium API' })
  @ApiResponse({ status: 200, description: 'Computation status retrieved' })
  async getComputationStatus(@Param('computationId') computationId: string) {
    return this.arciumAPIService.getComputationStatus(computationId);
  }

  @Get('network-status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Arcium network status via API' })
  @ApiResponse({ status: 200, description: 'Network status retrieved' })
  async getNetworkStatus() {
    return this.arciumAPIService.getNetworkStatus();
  }

  @Get('computation-history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get computation history from Arcium API' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Computation history retrieved' })
  async getComputationHistory(@Query('limit') limit?: number) {
    return this.arciumAPIService.getComputationHistory(limit);
  }

  @Post('estimate-cost')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Estimate computation cost via Arcium API' })
  @ApiBody({ type: EncryptedComputationDto })
  @ApiResponse({ status: 200, description: 'Cost estimation completed' })
  async estimateComputationCost(@Body() request: ArciumComputationRequest) {
    return this.arciumAPIService.estimateComputationCost(request);
  }

  @Get('functions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get available computation functions from Arcium API',
  })
  @ApiResponse({ status: 200, description: 'Available functions retrieved' })
  async getAvailableFunctions() {
    return this.arciumAPIService.getAvailableFunctions();
  }

  @Get('health')
  @ApiOperation({ summary: 'Arcium API health check' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  async healthCheck(): Promise<{ healthy: boolean }> {
    const healthy = await this.arciumAPIService.healthCheck();
    return { healthy };
  }
}
