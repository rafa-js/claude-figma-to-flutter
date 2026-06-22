// fonts.dart - load the exact Figma fonts into the test engine.
//
// Unmatched fonts are the largest source of false differences, because text
// covers a large fraction of most screens. Register every weight the design
// uses, and make sure these .ttf files are listed under assets in pubspec.yaml.

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

Future<void> loadFonts() async {
  TestWidgetsFlutterBinding.ensureInitialized();

  // TODO: replace with the actual family names and weights from the design.
  final loader = FontLoader('Inter')
    ..addFont(rootBundle.load('assets/fonts/Inter-Regular.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Inter-Medium.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Inter-SemiBold.ttf'))
    ..addFont(rootBundle.load('assets/fonts/Inter-Bold.ttf'));
  await loader.load();
}
