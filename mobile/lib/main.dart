import 'dart:ui';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;

void main() {
  runApp(const MyApp());
}

class AppColors {
  static const Color primary = Color(0xFF4647D3);
  static const Color onPrimary = Color(0xFFF4F1FF);
  static const Color primaryContainer = Color(0xFF9396FF);
  static const Color onPrimaryContainer = Color(0xFF0A0081);

  static const Color secondary = Color(0xFF006947);
  static const Color secondaryContainer = Color(0xFF69F6B8);
  static const Color onSecondary = Color(0xFFC8FFE0);
  static const Color onSecondaryContainer = Color(0xFF005A3C);

  static const Color background = Color(0xFFFAF4FF);
  static const Color surfaceContainerLowest = Color(0xFFFFFFFF);
  static const Color surfaceContainerLow = Color(0xFFF4EEFF);
  static const Color surfaceContainerHigh = Color(0xFFE6DEFF);
  static const Color onSurface = Color(0xFF302950);
  static const Color onSurfaceVariant = Color(0xFF5E5680);
  
  static const Color outlineVariant = Color(0xFFB0A7D6);
  static const Color error = Color(0xFFB41340);
  static const Color tertiary = Color(0xFF815100);
}

// ---------------- MODELS ----------------

class ShiftData {
  final String currentShift;
  final String recommendedShift;
  final String reasoning;
  final double savings;
  final String riskAvoided;

  ShiftData({
    required this.currentShift,
    required this.recommendedShift,
    required this.reasoning,
    required this.savings,
    required this.riskAvoided,
  });

  factory ShiftData.fromJson(Map<String, dynamic> json) {
    return ShiftData(
      currentShift: json['current_shift'] ?? 'Current',
      recommendedShift: json['recommended_shift'] ?? 'Recommended',
      reasoning: json['reasoning'] ?? 'Optimal choice',
      savings: double.tryParse(json['projected_earnings_saved']?.toString() ?? '0') ?? 0.0,
      riskAvoided: json['risk_avoided'] ?? 'general',
    );
  }
}

class ForecastPrediction {
  final String day;
  final String risk;
  final String message;

  ForecastPrediction({required this.day, required this.risk, required this.message});

  factory ForecastPrediction.fromJson(Map<String, dynamic> json) {
    return ForecastPrediction(
      day: json['day'] ?? 'Unknown',
      risk: json['risk'] ?? 'Low',
      message: json['message'] ?? '',
    );
  }
}

class ForecastData {
  final String zoneName;
  final String tier;
  final List<ForecastPrediction> predictions;

  ForecastData({required this.zoneName, required this.tier, required this.predictions});

  factory ForecastData.fromJson(Map<String, dynamic> json) {
    final list = json['predictions'] as List? ?? [];
    return ForecastData(
      zoneName: json['zone_name'] ?? 'Local Zone',
      tier: json['tier'] ?? 'Tier 1',
      predictions: list.map((e) => ForecastPrediction.fromJson(e)).toList(),
    );
  }
}

// ---------------- MAIN APP ----------------

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Velocity',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: AppColors.background,
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppColors.primary,
          background: AppColors.background,
          primary: AppColors.primary,
          secondary: AppColors.secondary,
        ),
        textTheme: TextTheme(
          displayLarge: GoogleFonts.plusJakartaSans(color: AppColors.onSurface, fontWeight: FontWeight.w800),
          displayMedium: GoogleFonts.plusJakartaSans(color: AppColors.onSurface, fontWeight: FontWeight.w800),
          headlineLarge: GoogleFonts.plusJakartaSans(color: AppColors.onSurface, fontWeight: FontWeight.w800),
          bodyLarge: GoogleFonts.inter(color: AppColors.onSurface),
          bodyMedium: GoogleFonts.inter(color: AppColors.onSurfaceVariant),
          labelSmall: GoogleFonts.inter(color: AppColors.onSurfaceVariant),
        ),
      ),
      home: const AppHost(),
    );
  }
}

// ---------------- HOST WIDGET (ROUTING) ----------------

class AppHost extends StatefulWidget {
  const AppHost({super.key});

  @override
  State<AppHost> createState() => _AppHostState();
}

class _AppHostState extends State<AppHost> {
  int _selectedIndex = 2; // Default to 'Shifts' tab

  final List<Widget> _screens = [
    const PlaceholderScreen(title: "Home"),
    const ForecastScreen(),
    const ShiftOptimizerScreen(),
    const PlaceholderScreen(title: "Insurance Policies"),
    const PlaceholderScreen(title: "Profile"),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Preserve state of underlying screens using IndexedStack
          IndexedStack(
            index: _selectedIndex,
            children: _screens,
          ),
          
          Align(
            alignment: Alignment.bottomCenter,
            child: GlassBottomNav(
              currentIndex: _selectedIndex,
              onTap: (index) {
                setState(() => _selectedIndex = index);
              },
            ),
          ),
        ],
      ),
    );
  }
}

class PlaceholderScreen extends StatelessWidget {
  final String title;
  const PlaceholderScreen({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Center(
        child: Text(
          title, 
          style: GoogleFonts.plusJakartaSans(
            fontSize: 24, fontWeight: FontWeight.w800, color: AppColors.outlineVariant
          )
        )
      )
    );
  }
}


// ---------------- FORECAST SCREEN ----------------

class ForecastScreen extends StatefulWidget {
  const ForecastScreen({super.key});

  @override
  State<ForecastScreen> createState() => _ForecastScreenState();
}

class _ForecastScreenState extends State<ForecastScreen> {
  late Future<ForecastData> _forecastFuture;

  @override
  void initState() {
    super.initState();
    _forecastFuture = fetchForecast();
  }

  Future<ForecastData> fetchForecast() async {
    try {
      final res = await http.get(Uri.parse('http://localhost:8000/api/triggers/predict/1'));
      if (res.statusCode == 200) {
        return ForecastData.fromJson(jsonDecode(res.body));
      } else {
        throw Exception('Failed to load API');
      }
    } catch (e) {
      // Fallback data
      return ForecastData(
        zoneName: 'Central District',
        tier: 'tier_1',
        predictions: [
          ForecastPrediction(day: 'Today', risk: 'High', message: 'Heavy monsoon rains expected 2-8 PM.'),
          ForecastPrediction(day: 'Tomorrow', risk: 'Medium', message: 'Residual flooding.'),
          ForecastPrediction(day: 'Wednesday', risk: 'Low', message: 'Clear skies.'),
        ]
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ForecastData>(
      future: _forecastFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: AppColors.primary));
        }
        
        final data = snapshot.data;
        if (data == null) {
          return const Center(child: Text("Data missing"));
        }

        return SingleChildScrollView(
          padding: const EdgeInsets.only(left: 24, right: 24, top: 16, bottom: 120),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const CustomHeader(),
              const SizedBox(height: 32),
              Text(
                '7-Day Forecast',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  color: AppColors.onSurface,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Actuarial risk timeline for ${data.zoneName}.',
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w500,
                  color: AppColors.onSurfaceVariant,
                ),
              ),
              const SizedBox(height: 32),
              
              // Render the timeline sequence
              ...data.predictions.map((p) => _buildDayRow(p)),

              const SizedBox(height: 24),
              // Helper Box
              Container(
                 padding: const EdgeInsets.all(20),
                 decoration: BoxDecoration(
                   color: AppColors.surfaceContainerHigh.withOpacity(0.5),
                   borderRadius: BorderRadius.circular(12),
                 ),
                 child: Row(
                   children: [
                     const Icon(Icons.info_outline, color: AppColors.outlineVariant),
                     const SizedBox(width: 12),
                     Expanded(
                       child: Text(
                         'High risk days automatically trigger parametric insurance protections if you are caught on an active shift.',
                         style: GoogleFonts.inter(color: AppColors.onSurfaceVariant, fontSize: 12),
                       ),
                     ),
                   ],
                 )
              )
            ],
          ),
        );
      }
    );
  }

  Widget _buildDayRow(ForecastPrediction p) {
    Color cardColor = AppColors.surfaceContainerLow;
    Color accentColor = AppColors.outlineVariant;
    IconData icon = Icons.wb_sunny_outlined;

    if (p.risk == 'High') {
      cardColor = const Color(0xFFFFF0F3); // light red accent background
      accentColor = AppColors.error;
      icon = Icons.warning_amber_rounded;
    } else if (p.risk == 'Medium') {
      cardColor = const Color(0xFFFFF7EA); // light amber
      accentColor = AppColors.tertiary;
      icon = Icons.umbrella_outlined;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: cardColor,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: accentColor.withOpacity(0.3), width: 1.5),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
             padding: const EdgeInsets.all(10),
             decoration: BoxDecoration(
               color: accentColor.withOpacity(0.15),
               borderRadius: BorderRadius.circular(12),
             ),
             child: Icon(icon, color: accentColor, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      p.day.toUpperCase(),
                      style: GoogleFonts.inter(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: accentColor,
                      )
                    ),
                    if (p.risk != 'Low')
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                           color: accentColor,
                           borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          p.risk.toUpperCase() + ' RISK',
                          style: GoogleFonts.inter(
                             color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800
                          )
                        )
                      )
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  p.message,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
              ],
            ),
          )
        ],
      )
    );
  }
}


// ---------------- SHIFT OPTIMIZER SCREEN ----------------

class ShiftOptimizerScreen extends StatefulWidget {
  const ShiftOptimizerScreen({super.key});

  @override
  State<ShiftOptimizerScreen> createState() => _ShiftOptimizerScreenState();
}

class _ShiftOptimizerScreenState extends State<ShiftOptimizerScreen> {
  late Future<ShiftData> _shiftDataFuture;
  bool _isSwitching = false;

  @override
  void initState() {
    super.initState();
    _shiftDataFuture = fetchShiftData();
  }

  Future<ShiftData> fetchShiftData() async {
    try {
      final res = await http.get(Uri.parse('http://localhost:8000/api/triggers/optimize/1'));
      if (res.statusCode == 200) {
        return ShiftData.fromJson(jsonDecode(res.body));
      } else {
        throw Exception('Failed to load data');
      }
    } catch (e) {
      // Fallback data if backend is asleep/unreachable
      return ShiftData(
        currentShift: 'Mon Evening',
        recommendedShift: 'Mon Morning',
        reasoning: 'Backend unreachable. Proceeding with fallback static optimizations.',
        savings: 420.0,
        riskAvoided: 'fallback',
      );
    }
  }

  void _onUpdateShift() async {
    setState(() => _isSwitching = true);
    await Future.delayed(const Duration(seconds: 2)); 
    
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Shift updated! Deliveries migrating.', style: GoogleFonts.inter()),
          backgroundColor: AppColors.secondary,
        )
      );
      setState(() => _isSwitching = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<ShiftData>(
      future: _shiftDataFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator(color: AppColors.primary));
        }

        final data = snapshot.data;
        if (data == null) {
          return const Center(child: Text("Error fetching optimizations"));
        }

        return SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.only(left: 24, right: 24, top: 16, bottom: 120),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const CustomHeader(),
                const SizedBox(height: 32),
                const HeroSection(),
                const SizedBox(height: 32),
                EarningsPulseCard(savings: data.savings),
                const SizedBox(height: 32),
                BentoGrid(current: data.currentShift, recommended: data.recommendedShift, savings: data.savings),
                const SizedBox(height: 32),
                InsightsSection(reasoning: data.reasoning, riskType: data.riskAvoided),
                const SizedBox(height: 48),
                ActionButton(onTap: _onUpdateShift, isLoading: _isSwitching),
              ],
            ),
          ),
        );
      }
    );
  }
}

class CustomHeader extends StatelessWidget {
  const CustomHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primaryContainer,
                image: DecorationImage(
                  image: NetworkImage(
                    'https://lh3.googleusercontent.com/aida-public/AB6AXuBVYBjGBGg9ssoXocKNQh7J3G3CUG70SJeZdEjMRLlaaEA0AuinO1VuHgmaWzdGU_VALvqqB1d0MhvWsYWZxplJvsvsjb-KuyviAkF3ZddUgAB_k9-5GhF0RUAmOtrKujAMuKpJkzEMBq_FrVHlJMI1ZaPyGuK5hCwif-PpeCiaQ7D9BeFxOMYDdyE3UwfIQOx4VA5kfs9_4OjPr3rpF8aki6FdnhTJdrgXSvUQ0bWjYkCgVaQylaJCsIci5mb2dbzwJTyjYVfs6dOd',
                  ),
                  fit: BoxFit.cover,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Text(
              'Velocity',
              style: GoogleFonts.plusJakartaSans(
                color: AppColors.primary,
                fontSize: 20,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
        IconButton(
          icon: const Icon(Icons.notifications_none, color: AppColors.primary),
          onPressed: () {},
        )
      ],
    );
  }
}

class HeroSection extends StatelessWidget {
  const HeroSection({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Shift Optimizer',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: AppColors.onSurface,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Maximize your earnings with real-time route analysis.',
          style: GoogleFonts.inter(
            fontSize: 15,
            fontWeight: FontWeight.w500,
            color: AppColors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class EarningsPulseCard extends StatelessWidget {
  final double savings;
  const EarningsPulseCard({super.key, required this.savings});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.secondaryContainer,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
            color: Color(0x14006947),
            blurRadius: 32,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            right: -40,
            bottom: -40,
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.onSecondaryContainer.withOpacity(0.05),
              ),
            ),
          ),
          Positioned(
            right: -16,
            bottom: -16,
            child: Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.onSecondaryContainer.withOpacity(0.1),
              ),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Optimization Ready',
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.onSecondaryContainer,
                        fontWeight: FontWeight.w700,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Earn ₹${savings.toInt()} more today',
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.onSecondaryContainer,
                        fontWeight: FontWeight.w800,
                        fontSize: 26,
                        height: 1.1,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: const BoxDecoration(
                  color: AppColors.onSecondaryContainer,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.trending_up,
                  color: AppColors.secondaryContainer,
                  size: 32,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class BentoGrid extends StatelessWidget {
  final String current;
  final String recommended;
  final double savings;
  
  const BentoGrid({
    super.key,
    required this.current,
    required this.recommended,
    required this.savings,
  });

  @override
  Widget build(BuildContext context) {
    const basePayout = 800;
    
    return Row(
      children: [
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLow,
              borderRadius: BorderRadius.circular(12),
              border: const Border(left: BorderSide(color: AppColors.outlineVariant, width: 4)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CURRENT SLOT',
                  style: GoogleFonts.inter(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 1.5,
                    color: AppColors.onSurfaceVariant,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  current,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
                const SizedBox(height: 32),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '₹$basePayout',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 4.0),
                      child: Text(
                        'Est.',
                        style: GoogleFonts.inter(
                          fontSize: 12,
                          color: AppColors.onSurfaceVariant,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                )
              ],
            ),
          ),
        ),
        const SizedBox(width: 16),
        // Recommended Slot
        Expanded(
          child: Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: AppColors.surfaceContainerLowest,
              borderRadius: BorderRadius.circular(12),
              border: const Border(left: BorderSide(color: AppColors.primary, width: 4)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x0A4647D3),
                  blurRadius: 24,
                  offset: Offset(0, 8),
                ),
              ],
            ),
            child: Stack(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'OPTIMAL SLOT',
                      style: GoogleFonts.inter(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 1.5,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      recommended,
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                    ),
                    const SizedBox(height: 24),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Text(
                          '₹${basePayout + savings.toInt()}',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 26,
                            fontWeight: FontWeight.w800,
                            color: AppColors.primary,
                          ),
                        ),
                        const SizedBox(width: 4),
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6.0),
                          child: Text(
                            'Est.',
                            style: GoogleFonts.inter(
                              fontSize: 12,
                              color: AppColors.onSurfaceVariant,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.add_circle, color: AppColors.secondary, size: 14),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            '₹${savings.toInt()} momentum',
                            style: GoogleFonts.inter(
                              fontSize: 11,
                              color: AppColors.secondary,
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
                Positioned(
                  top: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'RECOMMENDED',
                      style: GoogleFonts.inter(
                        fontSize: 7,
                        color: AppColors.onPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class InsightsSection extends StatelessWidget {
  final String reasoning;
  final String riskType;
  
  const InsightsSection({super.key, required this.reasoning, required this.riskType});

  @override
  Widget build(BuildContext context) {
    IconData riskIcon = Icons.policy;
    Color riskColor = AppColors.primary;
    if (riskType == 'heat') {
      riskIcon = Icons.thermostat;
      riskColor = AppColors.error;
    } else if (riskType == 'rainfall') {
      riskIcon = Icons.water_drop;
      riskColor = AppColors.primary;
    } else if (riskType == 'aqi') {
      riskIcon = Icons.air;
      riskColor = AppColors.tertiary;
    }

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppColors.surfaceContainerLow,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Why this shift?',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
            ),
          ),
          const SizedBox(height: 24),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(riskIcon, color: riskColor, size: 20),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Risk Avoidance Algorithm',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      reasoning,
                      style: GoogleFonts.inter(
                        color: AppColors.onSurfaceVariant,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              )
            ],
          ),
          const SizedBox(height: 20),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: AppColors.surfaceContainerHigh,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.security, color: AppColors.secondary, size: 20),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Safety Bonus',
                      style: GoogleFonts.inter(
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface,
                        fontSize: 15,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Shift qualifies for the "Secure Horizon" insurance rebate.',
                      style: GoogleFonts.inter(
                        color: AppColors.onSurfaceVariant,
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              )
            ],
          )
        ],
      ),
    );
  }
}

class ActionButton extends StatelessWidget {
  final VoidCallback onTap;
  final bool isLoading;
  
  const ActionButton({super.key, required this.onTap, this.isLoading = false});

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        ElevatedButton(
          onPressed: isLoading ? null : onTap,
          style: ElevatedButton.styleFrom(
            backgroundColor: AppColors.primary,
            foregroundColor: AppColors.onPrimary,
            minimumSize: const Size(double.infinity, 64),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(12),
            ),
            elevation: 8,
            shadowColor: AppColors.primary.withOpacity(0.5),
          ),
          child: isLoading 
            ? const SizedBox(
                width: 24, height: 24,
                child: CircularProgressIndicator(color: AppColors.onPrimary, strokeWidth: 3)
              ) 
            : Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'Update Shift',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'One-tap update. All pending deliveries will be migrated.',
          style: GoogleFonts.inter(
            fontSize: 12,
            color: AppColors.onSurfaceVariant,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

// ---------------- BOTTOM NAVIGATION ----------------

class GlassBottomNav extends StatelessWidget {
  final int currentIndex;
  final ValueChanged<int> onTap;

  const GlassBottomNav({super.key, required this.currentIndex, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: const BorderRadius.only(
        topLeft: Radius.circular(24),
        topRight: Radius.circular(24),
      ),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          color: Colors.white.withOpacity(0.85),
          padding: const EdgeInsets.only(top: 12, bottom: 24, left: 16, right: 16),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _NavItem(icon: Icons.home_outlined, label: 'Home', isActive: currentIndex == 0, onTap: () => onTap(0)),
              _NavItem(icon: Icons.trending_up, label: 'Forecast', isActive: currentIndex == 1, onTap: () => onTap(1)),
              _NavItem(icon: Icons.schedule, label: 'Shifts', isActive: currentIndex == 2, onTap: () => onTap(2)),
              _NavItem(icon: Icons.verified_user_outlined, label: 'Insurance', isActive: currentIndex == 3, onTap: () => onTap(3)),
              _NavItem(icon: Icons.person_outline, label: 'Profile', isActive: currentIndex == 4, onTap: () => onTap(4)),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isActive;
  final VoidCallback onTap;

  const _NavItem({
    required this.icon,
    required this.label,
    required this.isActive,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: isActive
            ? BoxDecoration(
                color: AppColors.primary.withOpacity(0.12),
                borderRadius: BorderRadius.circular(16),
              )
            : null,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isActive ? AppColors.primary : const Color(0xFF94A3B8), // slate-400
              size: 24,
            ),
            const SizedBox(height: 4),
            Text(
              label,
              style: GoogleFonts.inter(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: isActive ? AppColors.primary : const Color(0xFF94A3B8),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
