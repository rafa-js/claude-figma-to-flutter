// render_to_png.dart - capture a widget to a PNG at matched size and DPR (Step 3).
//
// Copy into test/golden/<frame>_capture_test.dart and adapt. Running with
// --update-goldens writes the PNG; the diff is done outside Flutter by diff.py.
//
//   flutter test test/golden/<frame>_capture_test.dart --update-goldens
//
// The key is matching the Figma export: physicalSize is the frame logical size,
// devicePixelRatio is the export scale, so logical * dpr == exported pixels.

import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';

// import '../harness/fonts.dart';        // loadFonts()
// import '../../lib/ui/components/my_widget.dart';

const Size kFrameLogicalSize = Size(393, 852); // TODO: from the Figma frame
const double kExportDpr = 2.0;                  // TODO: match the export scale
const String kOutPath =
    '.claude/tasks/TASK_ID/attempts/001/render.png'; // TODO: set per attempt

void main() {
  testWidgets('capture frame', (WidgetTester tester) async {
    // await loadFonts(); // load the exact Figma fonts before pumping

    tester.view.physicalSize = kFrameLogicalSize * kExportDpr;
    tester.view.devicePixelRatio = kExportDpr;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      const MaterialApp(
        debugShowCheckedModeBanner: false,
        home: RepaintBoundary(
          // child: MyWidget(), // TODO: the target widget under test
          child: SizedBox.expand(),
        ),
      ),
    );
    await tester.pumpAndSettle(); // settle animations for determinism

    final boundary = tester.firstRenderObject<RenderRepaintBoundary>(
      find.byType(RepaintBoundary),
    );
    final ui.Image image = await boundary.toImage(pixelRatio: kExportDpr);
    final ByteData? bytes =
        await image.toByteData(format: ui.ImageByteFormat.png);

    final file = File(kOutPath);
    await file.parent.create(recursive: true);
    await file.writeAsBytes(bytes!.buffer.asUint8List());
  });
}
