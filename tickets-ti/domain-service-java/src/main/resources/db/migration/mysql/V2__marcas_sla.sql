-- M-04 / M-01: marcas de la alerta del 80 % y del vencimiento del SLA. Admiten null: las filas existentes quedan sin marca.
alter table ticket
    add column alerta_sla_en datetime(6),
    add column sla_vencido_en datetime(6);
