package com.ticketsti.soporte.architecture;

import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.classes;
import static com.tngtech.archunit.lang.syntax.ArchRuleDefinition.noClasses;

import com.tngtech.archunit.core.importer.ImportOption;
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;
import com.tngtech.archunit.lang.ArchRule;

/** Las reglas de la arquitectura hexagonal escritas como pruebas: si alguien rompe una, el build falla. */
@AnalyzeClasses(packages = "com.ticketsti.soporte", importOptions = ImportOption.DoNotIncludeTests.class)
class ArquitecturaHexagonalTest {

    @ArchTest
    static final ArchRule el_dominio_no_depende_de_aplicacion_ni_infraestructura =
            noClasses().that().resideInAPackage("..domain..")
                    .should().dependOnClassesThat().resideInAnyPackage("..application..", "..infrastructure..");

    @ArchTest
    static final ArchRule el_dominio_no_conoce_frameworks =
            noClasses().that().resideInAPackage("..domain..")
                    .should().dependOnClassesThat().resideInAnyPackage(
                            "org.springframework..", "jakarta..", "javax.persistence..", "io.jsonwebtoken..",
                            "com.fasterxml..");

    @ArchTest
    static final ArchRule la_aplicacion_no_depende_de_la_infraestructura =
            noClasses().that().resideInAPackage("..application..")
                    .should().dependOnClassesThat().resideInAPackage("..infrastructure..");

    @ArchTest
    static final ArchRule la_aplicacion_no_conoce_frameworks =
            noClasses().that().resideInAPackage("..application..")
                    .should().dependOnClassesThat().resideInAnyPackage("org.springframework..", "jakarta..", "io.jsonwebtoken..");

    @ArchTest
    static final ArchRule los_puertos_de_salida_son_interfaces =
            classes().that().resideInAPackage("..application.port.out..").should().beInterfaces();

    @ArchTest
    static final ArchRule los_controladores_no_conocen_la_persistencia =
            noClasses().that().resideInAPackage("..adapters.in..")
                    .should().dependOnClassesThat().resideInAPackage("..adapters.out..");

    @ArchTest
    static final ArchRule la_persistencia_no_conoce_los_controladores =
            noClasses().that().resideInAPackage("..adapters.out..")
                    .should().dependOnClassesThat().resideInAPackage("..adapters.in..");

    @ArchTest
    static final ArchRule los_controladores_dependen_de_casos_de_uso_no_de_servicios_concretos =
            noClasses().that().resideInAPackage("..adapters.in..")
                    .should().dependOnClassesThat().resideInAPackage("..application.service..");
}
